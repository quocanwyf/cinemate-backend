/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FcmService {
  private logger = new Logger(FcmService.name);

  constructor() {
    // Load Firebase service account từ file
    const serviceAccountPath = path.join(
      process.cwd(),
      'firebase-service-account.json',
    );

    if (!fs.existsSync(serviceAccountPath)) {
      this.logger.warn('Firebase service account file not found!');
      return;
    }

    try {
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf8'),
      );

      // Initialize Firebase Admin
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Firebase: ${error.message}`);
    }
  }

  /**
   * Gửi push notification tới device
   * @param deviceToken - FCM token từ device
   * @param title - Tiêu đề
   * @param body - Nội dung
   * @param data - Extra data (deeplink, etc)
   */
  async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token: deviceToken,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push sent successfully: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push: ${error.message}`);
      return false;
    }
  }

  /**
   * Gửi push tới nhiều devices
   */
  async sendMulticastNotification(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<number> {
    try {
      if (!deviceTokens || deviceTokens.length === 0) {
        return 0;
      }

      // Tạo message template
      const createMessage = (token: string) => ({
        notification: {
          title,
          body,
        },
        data: data || {},
        token,
      });

      // Gửi push cho từng device (loop)
      let successCount = 0;
      for (const token of deviceTokens) {
        try {
          await admin.messaging().send(createMessage(token));
          successCount++;
        } catch (tokenError) {
          this.logger.warn(
            `Failed to send to token ${token}: ${tokenError.message}`,
          );
        }
      }

      this.logger.log(
        `Multicast sent: ${successCount} success, ${deviceTokens.length - successCount} failed`,
      );
      return successCount;
    } catch (error) {
      this.logger.error(`Failed to send multicast: ${error.message}`);
      return 0;
    }
  }
}
