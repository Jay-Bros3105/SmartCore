/**
 * EMAILJS — USANIDI WA ARIFA NA RESET PASSWORD
 *
 * Hatua:
 * 1. Akaunti ya FREE kwenye https://www.emailjs.com
 * 2. Email Services → Add New Service → Gmail → login na smartcore125@gmail.com
 * 3. Email Templates:
 *    - "Neo-SmartCore — Admin Notification":
 *        bandika (Code Editor, HTML mode) email-templates/neo-smartcore-email-template.html
 *        VARIABLES zake: {{category}}, {{to_name}}, {{message}}, {{source}},
 *        {{title}}, {{details}}, {{submitted_by}}, {{date}}, {{reference_id}},
 *        {{action_url}}, {{current_year}}  → pata TEMPLATE_ID (Notify)
 *    - "Neo-SmartCore — Reset Your Password":
 *        bandika email-templates/neo-smartcore-reset-password-template.html
 *        VARIABLES zake: {{to_name}}, {{account_email}}, {{reset_link}},
 *        {{expiry_minutes}}, {{request_time}}, {{ip_address}}, {{current_year}}
 *        → pata TEMPLATE_ID (Reset)
 * 4. Account → General → nakili Public Key
 * 5. Andika hizo values hapa chini, kisha EMAILJS_CONFIGURED = true.
 */
export const EMAILJS_SERVICE_ID = 'service_benv4em';
export const EMAILJS_NOTIFY_TEMPLATE_ID = 'template_jnbs0fe';
export const EMAILJS_RESET_TEMPLATE_ID = 'template_ha4k6js';
export const EMAILJS_PUBLIC_KEY = '5goLunm_lpFAx_1gl';
export const SUPER_ADMIN_EMAIL = 'smartcore125@gmail.com';

export const EMAILJS_CONFIGURED = true;

export function isEmailJsConfigured(): boolean {
  return (
    EMAILJS_CONFIGURED &&
    EMAILJS_SERVICE_ID.length > 0 &&
    EMAILJS_NOTIFY_TEMPLATE_ID.length > 0 &&
    EMAILJS_PUBLIC_KEY.length > 0
  );
}