// Google Calendar API クライアント（シンプル実装）
import { google } from 'googleapis';
import { GoogleCalendarEvent } from '@/types/shared';

// OAuth2設定（開発環境用）
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
);

// Calendar APIクライアント
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

/**
 * Google Calendar API クライアント
 * シンプルな実装でエラーが起きにくい設計
 */
export class GoogleCalendarClient {
  private auth: typeof oauth2Client;
  private calendarApi: typeof calendar;

  constructor(accessToken?: string, refreshToken?: string) {
    this.auth = oauth2Client;
    this.calendarApi = calendar;

    // アクセストークンが提供されている場合は設定
    if (accessToken || refreshToken) {
      this.auth.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }

  /**
   * 認証URL生成（OAuth2フロー開始）
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // 毎回同意画面を表示（開発用）
    });
  }

  /**
   * 認証コードからトークン取得
   */
  async getTokenFromCode(code: string): Promise<{
    access_token?: string | null;
    refresh_token?: string | null;
  }> {
    try {
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      };
    } catch (error) {
      console.error('Google認証エラー:', error);
      throw new Error('Google認証に失敗しました');
    }
  }

  /**
   * カレンダーイベント一覧取得（シンプル版）
   */
  async getEvents(
    startDate?: string,
    endDate?: string,
    maxResults = 10
  ): Promise<GoogleCalendarEvent[]> {
    try {
      const response = await this.calendarApi.events.list({
        calendarId: 'primary',
        timeMin: startDate || new Date().toISOString(),
        timeMax: endDate,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      
      // 内部形式に変換
      return events.map(event => ({
        id: event.id || '',
        summary: event.summary || 'タイトルなし',
        description: event.description || undefined,
        start: {
          dateTime: event.start?.dateTime || event.start?.date || '',
          timeZone: event.start?.timeZone || undefined,
        },
        end: {
          dateTime: event.end?.dateTime || event.end?.date || '',
          timeZone: event.end?.timeZone || undefined,
        },
        location: event.location || undefined,
      }));
    } catch (error) {
      console.error('Google Calendarイベント取得エラー:', error);
      throw new Error('カレンダーイベント取得に失敗しました');
    }
  }

  /**
   * イベント作成（シンプル版）
   */
  async createEvent(event: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
  }): Promise<GoogleCalendarEvent> {
    try {
      const response = await this.calendarApi.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          description: event.description,
          start: {
            dateTime: event.startTime,
            timeZone: 'Asia/Tokyo',
          },
          end: {
            dateTime: event.endTime,
            timeZone: 'Asia/Tokyo',
          },
          location: event.location,
        },
      });

      const createdEvent = response.data;
      
      return {
        id: createdEvent.id || '',
        summary: createdEvent.summary || '',
        description: createdEvent.description || undefined,
        start: {
          dateTime: createdEvent.start?.dateTime || '',
          timeZone: createdEvent.start?.timeZone || undefined,
        },
        end: {
          dateTime: createdEvent.end?.dateTime || '',
          timeZone: createdEvent.end?.timeZone || undefined,
        },
        location: createdEvent.location || undefined,
      };
    } catch (error) {
      console.error('Google Calendarイベント作成エラー:', error);
      throw new Error('カレンダーイベント作成に失敗しました');
    }
  }

  /**
   * 接続テスト（開発用）
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.calendarApi.calendarList.list();
      return response.status === 200;
    } catch (error) {
      console.error('Google Calendar接続テストエラー:', error);
      return false;
    }
  }
}

/**
 * デフォルトクライアントインスタンス（シンプル使用）
 */
export const googleCalendar = new GoogleCalendarClient();

/**
 * ユーザー認証付きクライアント生成
 */
export function createUserCalendarClient(accessToken: string, refreshToken: string) {
  return new GoogleCalendarClient(accessToken, refreshToken);
}