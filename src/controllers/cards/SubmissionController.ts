import type { Context } from 'hono';
import prisma from '../../utils/db.js';
import path from 'path';
import fs from 'fs';
import { Buffer } from 'buffer';
import {verifyToken}  from "../../utils/jwt.js"


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
      prisma.card.findUnique({ where: { id: Number(cardId) } }),
      departmentId 
        ? prisma.department.findUnique({ where: { id: Number(departmentId) } })
        : Promise.resolve(true)
    ]);

    if (!cardExists) return c.json({ error: 'Card not found' }, 404);
    if (departmentId && !departmentExists) {
      return c.json({ error: 'Department not found' }, 404);
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

    // Database operation - now creates both submission and file records in a transaction
    const [submission, fileRecord] = await prisma.$transaction([
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
    const cardId = c.req.param('id');

    const files = await prisma.file.findMany({
      where: {
        cardId: Number(cardId)
      },
      include: {
        user: { // Include user details for owner
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
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