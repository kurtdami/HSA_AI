import { Router, Response, NextFunction } from 'express';
import { authenticateUser } from '../middleware/auth';
import { run } from '../services/genai/app';
import { AuthenticatedRequest } from '../../types/auth';
import { ReceiptAnalysisRequest, ReceiptAnalysisResponse, ErrorResponse } from '../../types/api';

const router = Router();

router.post('/analyze', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  console.log('Received receipt analysis request');
  try {
    const { imageData } = req.body as ReceiptAnalysisRequest;
    console.log('Image data received:', imageData ? 'Present (length: ' + imageData.length + ')' : 'Missing');
    
    if (!process.env.GEMINI_API_KEY) {
      console.error('Gemini API key not configured');
      const error: ErrorResponse = { error: 'Gemini API key not configured' };
      res.status(500).json(error);
      return;
    }

    console.log('Calling Gemini API...');
    const result = await run(imageData);
    console.log('Gemini API response:', result ? 'Present' : 'Missing');
    
    if (!result || !result.response) {
      console.error('Invalid response from Gemini API:', result);
      const error: ErrorResponse = { error: 'Invalid response from Gemini API' };
      res.status(500).json(error);
      return;
    }

    const responseText = result.response.text();
    console.log('Sending response back to client:', responseText.substring(0, 100) + '...');
    
    const response: ReceiptAnalysisResponse = { text: responseText };
    res.json(response);
  } catch (error) {
    console.error('Receipt analysis error:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to analyze receipt' };
    res.status(500).json(errorResponse);
  }
});

export default router; 