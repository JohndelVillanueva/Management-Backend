import type { Context } from 'hono';
import prisma from '../../utils/db.js';
import path from 'path';
import fs from 'fs';
import { Buffer } from 'buffer';
import {verifyToken}  from "../../utils/jwt.js"

const isFileTypeAllowed = (fileName: string, allowedFileTypes: string[]): boolean => {
  if (allowedFileTypes.includes('*')) return true;
  
  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase();
  
  return allowedFileTypes.some(allowedType => {
    if (allowedType.includes(',')) {
      // Handle multiple extensions like ".doc,.docx"
      return allowedType.split(',').some(ext => ext.trim() === fileExtension);
    } else if (allowedType === 'image/*') {
      // Handle image wildcard
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
      return imageExtensions.includes(fileExtension || '');
    } else {
      // Handle single extension or exact match
      return allowedType === fileExtension;
    }
  });
};


export const createSubmission = async (c: Context) => {
  let body: any;
  let decoded: any;
  let userId: number;
  
  try {
    // Authentication
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];
    decoded = verifyToken(token) as { id: number };
    userId = decoded.id;

    // Request processing
    body = await c.req.parseBody();
    const file = body['file'];
    const { title, description, type, departmentId } = body;
    const existingSubmissionId = body['submissionId'] ? Number(body['submissionId']) : null;
    
    // Validation
    if (!file || !title || !type) {
      return c.json({ error: 'Missing required fields: file, title, and type are required' }, 400);
    }
    if (typeof file === 'string') {
      return c.json({ error: 'Invalid file type' }, 400);
    }
    if (!file.name || !file.type || !file.size) {
      return c.json({ error: 'Invalid file: missing name, type, or size' }, 400);
    }

    const cardId = c.req.param('id');
    if (!cardId) return c.json({ error: 'Card ID required' }, 400);

    // Verify resources exist
    const [cardExists, departmentExists] = await Promise.all([
      prisma.card.findUnique({ 
        where: { id: Number(cardId) },
        select: { id: true, allowedFileTypes: true } // Include allowedFileTypes
      }),
      departmentId 
        ? prisma.department.findUnique({ where: { id: Number(departmentId) } })
        : Promise.resolve(true)
    ]);

    if (!cardExists) return c.json({ error: 'Card not found' }, 404);
    if (departmentId && !departmentExists) {
      return c.json({ error: 'Department not found' }, 404);
    }

    // ✅ ADD FILE TYPE VALIDATION HERE
    const allowedTypes = cardExists.allowedFileTypes.split(',');
    if (!isFileTypeAllowed(file.name, allowedTypes)) {
      const allowedTypesDisplay = allowedTypes.includes('*') 
        ? 'All file types' 
        : allowedTypes.join(', ');
      
      return c.json({ 
        error: `File type not allowed. This card only accepts: ${allowedTypesDisplay}` 
      }, 400);
    }

    // If uploading to an existing submission, ensure it belongs to this card
    let targetSubmission: any = null;
    if (existingSubmissionId) {
      targetSubmission = await prisma.submission.findUnique({ where: { id: existingSubmissionId } });
      if (!targetSubmission || targetSubmission.cardId !== Number(cardId)) {
        return c.json({ error: 'Submission not found for this card' }, 404);
      }
    }

    // File processing
    const uniqueName = `${Date.now()}-${file.name}`;
    const uploadPath = path.join(process.cwd(), 'uploads', 'submissions', uniqueName);
    
    fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    
    // Handle file upload more robustly
    let fileBuffer: Buffer;
    if (file.arrayBuffer) {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else if (file.buffer) {
      fileBuffer = file.buffer;
    } else {
      throw new Error('Unsupported file format');
    }
    
    fs.writeFileSync(uploadPath, fileBuffer);

    let submission: any;
    let fileRecord: any;
    if (existingSubmissionId) {
      // Update existing submission's link and optionally metadata, create a file record
      [submission, fileRecord] = await prisma.$transaction([
        prisma.submission.update({
          where: { id: existingSubmissionId },
          data: {
            title: String(title),
            description: description?.toString(),
            type: String(type),
            link: `/uploads/submissions/${uniqueName}`,
          },
          include: {
            user: { select: { id: true, username: true } },
            department: true
          }
        }),
        prisma.file.create({
          data: {
            name: uniqueName,
            originalName: file.name,
            type: file.type,
            mimeType: file.type,
            size: file.size,
            path: `/uploads/submissions/${uniqueName}`,
            cardId: Number(cardId),
            userId: userId
          }
        })
      ]);
    } else {
      // Create new submission and file
      [submission, fileRecord] = await prisma.$transaction([
        prisma.submission.create({
          data: {
            title: String(title),
            description: description?.toString(),
            type: String(type),
            link: `/uploads/submissions/${uniqueName}`,
            userId,
            cardId: Number(cardId),
            departmentId: departmentId ? Number(departmentId) : null
          },
          include: {
            user: { select: { id: true, username: true } },
            department: true
          }
        }),
        prisma.file.create({
          data: {
            name: uniqueName,
            originalName: file.name,
            type: file.type,
            mimeType: file.type,
            size: file.size,
            path: `/uploads/submissions/${uniqueName}`,
            cardId: Number(cardId),
            userId: userId
          }
        })
      ]);
    }

    return c.json({ 
      success: true,
      data: {
        submission,
        file: fileRecord // Include the file record in response if needed
      }
    }, 201);

  } catch (error) {
    console.error('Submission failed:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      body: body,
      cardId: c.req.param('id'),
      userId: decoded?.id
    });
    
    // Enhanced error handling for Prisma errors
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'meta' in error
    ) {
      return c.json({
        error: 'Database error',
        code: (error as any).code,
        meta: (error as any).meta
      }, 500);
    }

    return c.json({ 
      error: 'Submission failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
};

export const getSubmissionsByCard = async (c: Context) => {
  try {
    const cardId = c.req.param('id');
    
    const submissions = await prisma.submission.findMany({
      where: {
        cardId: Number(cardId)
      },
      include: {
        
        user: {  // Include user details
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        },
        
        card: true,
        department: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return c.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return c.json({ error: 'Failed to fetch submissions' }, 500);
  }
};

export const getFilesBySubmission = async (c: Context) => {
  try {
    const paramId = c.req.param('submissionId') ?? c.req.param('id');
    const cardId = Number(paramId);
    if (!cardId || Number.isNaN(cardId)) {
      return c.json({ error: 'Invalid card id' }, 400);
    }

    const files = await prisma.file.findMany({
      where: { cardId },
      include: {
        user: {
          select: { id: true, first_name: true, last_name: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return c.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    return c.json({ error: 'Failed to fetch files' }, 500);
  }
};

export const getSubmissionById = async (c: Context) => {
  try {
    const submissionId = c.req.param('submissionId');
    
    const submission = await prisma.submission.findUnique({
      where: {
        id: Number(submissionId)
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        card: {
          select: {
            id: true,
            title: true,
            description: true,
            department: true
          }
        },
        department: true
      }
    });
    
    if (!submission) {
      return c.json({ error: 'Submission not found' }, 404);
    }
    
    return c.json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    return c.json({ error: 'Failed to fetch submission' }, 500);
  }
};

export const getAllSubmissions = async (c: Context) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: {
        status: 'active'
      },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        },
        card: {
          select: {
            id: true,
            title: true,
            description: true,
            departments: {
              include: {
                department: true
              }
            }
          }
        },
        department: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return c.json(submissions);
  } catch (error) {
    console.error('Error fetching all submissions:', error);
    return c.json({ error: 'Failed to fetch submissions' }, 500);
  }
};

export const getMySubmissions = async (c: Context) => {
  try {
    // --- 1. Authentication ---
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token) as { id: number };
    const userId = decoded.id;

    // --- 2. Check for 'recent' query parameter and set limit ---
    const recentQuery = c.req.query('recent');
    let limit: number | undefined = undefined;

    // Check if the 'recent' query parameter is present (value doesn't strictly matter for truthiness)
    if (recentQuery) {
      // The frontend currently limits to 5, so we will set a default limit here.
      limit = 5; 
    }

    // --- 3. Get submissions ---
    const submissions = await prisma.submission.findMany({
      where: {
        userId: userId
      },
      include: {
        card: {
          include: {
            // NOTE: I'm assuming 'files' is a relation on the Card model here.
            // If the files are associated directly with the Submission model, this structure needs adjustment.
            files: { 
              select: { id: true }
            }
          }
        },
        department: true,
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      // Apply the limit if 'recent=true' was in the query
      take: limit 
    });

    // --- 4. Transform data ---
    const formattedSubmissions = submissions.map(submission => ({
      id: submission.id,
      title: submission.title,
      description: submission.description || '',
      submission_date: submission.createdAt.toISOString(),
      // The status should ideally come from the submission record itself (e.g., submission.status)
      // If the Submission model has a status field, use that instead of hardcoding 'PENDING'.
      status: submission.status || 'PENDING', 
      department: {
        id: submission.department?.id || 0,
        name: submission.department?.name || 'No Department'
      },
      cardType: {
        id: submission.card?.id || submission.id,
        // Assuming Card model uses 'name' or 'title' for the card name. Using 'title' as it was in the original context, but typically 'name' is preferred.
        name: submission.card?.title || 'Card' 
      },
      submitted_by: {
        id: submission.user.id,
        first_name: submission.user.first_name,
        last_name: submission.user.last_name
      },
      // Count files from the card
      files_count: submission.card?.files?.length || 0,
      last_updated: submission.updatedAt.toISOString()
    }));

    return c.json({
      success: true,
      data: formattedSubmissions
    });

  } catch (error) {
    console.error('Error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to fetch submissions'
    }, 500);
  }
};
