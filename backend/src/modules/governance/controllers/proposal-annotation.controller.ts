import { Response } from 'express';
import { AuthRequest } from '../../../core/types/Ujamaadao.types.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { proposalAnnotationService } from '../services/proposal-annotation.service.js';

export class ProposalAnnotationController {
  static async createAnnotation(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId } = req.params;
    const result = await proposalAnnotationService.create(
      userId,
      proposalId,
      req.body
    );
    sendSuccess(res, result, 'Annotation created', 201);
  }

  static async listAnnotations(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    const { proposalId } = req.params;
    const result = await proposalAnnotationService.list(proposalId, userId);
    sendSuccess(res, result);
  }

  static async deleteAnnotation(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId, annotationId } = req.params;
    const result = await proposalAnnotationService.delete(
      userId,
      proposalId,
      annotationId
    );
    sendSuccess(res, result);
  }

  static async reactToAnnotation(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { proposalId, annotationId } = req.params;
    const { type } = req.body;
    const result = await proposalAnnotationService.react(
      userId,
      proposalId,
      annotationId,
      type
    );
    sendSuccess(res, result);
  }
}
