import type { Context } from 'hono';
import prisma from '../../utils/db.js';
import path from 'path';
import fs from 'fs';
import { Buffer } from 'buffer';
import {verifyToken}  from "../../utils/jwt.js"


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

export const getFileById = async (c: Context) => {
  try {
    const fileId = c.req.param('fileId');
    const file = await prisma.file.findUnique({
      where: { id: Number(fileId) },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }
    return c.json(file);
  } catch (error) {
    console.error('Error fetching file by ID:', error);
    return c.json({ error: 'Failed to fetch file' }, 500);
  }
};