import { google } from 'googleapis';
import { env } from './env';

export function getOAuth2Client() {
  return new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}
