import { Request, Response, NextFunction } from 'express';
import { MobileFeeService } from '../service/fee.service';

export class MobileFeeController {
  static async getFeeHistory(req: Request, res: Response, next: NextFunction) {
    try {
      // Current user is attached by the auth middleware
      const userId = req.user!.sub;
      const data = await MobileFeeService.getFeeHistory(userId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const { amount, method, cardDetails } = req.body;
      const payment = await MobileFeeService.processPayment(userId, amount, method || 'CARD', cardDetails);
      res.status(200).json({ success: true, data: payment, message: 'Payment processed successfully.' });
    } catch (error) {
      next(error);
    }
  }

  static async processPaymentStripe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const { amount, method, redirectUrl } = req.body;
      
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const host = req.get('host');
      const backendUrl = `${protocol}://${host}`;

      const session_url = await MobileFeeService.processPaymentStripe(userId, amount, method || 'CARD', backendUrl, redirectUrl);
      res.status(200).json({ success: true, data: session_url });
    } catch (error) {
      next(error);
    }
  }

  static async stripeSuccess(req: Request, res: Response, next: NextFunction) {
    try {
      const { session_id } = req.query;
      if (!session_id) {
        res.redirect('pyramideduapp://fees?status=failed&error=NoSessionId');
        return;
      }
      const redirectUrl = await MobileFeeService.handleStripeSuccess(session_id as string);
      res.redirect(redirectUrl);
    } catch (error: any) {
      console.error('Stripe redirect verification error:', error);
      res.redirect(`pyramideduapp://fees?status=failed&error=${encodeURIComponent(error.message)}`);
    }
  }

  static async stripeCancel(req: Request, res: Response, next: NextFunction) {
    try {
      res.redirect('pyramideduapp://fees?status=cancelled');
    } catch (error) {
      next(error);
    }
  }

  static async stripeWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers['stripe-signature'];
      if (!sig) {
        res.status(400).send('Missing stripe signature');
        return;
      }
      await MobileFeeService.handleStripeWebhook(sig as string, (req as any).rawBody);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook processing failed:', error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
}
