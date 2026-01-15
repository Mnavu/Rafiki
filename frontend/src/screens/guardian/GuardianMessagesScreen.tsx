import React from 'react';
import { VoiceThreadScreen, type QuickTemplate } from '../communications/VoiceThreadScreen';

const guardianTemplates: QuickTemplate[] = [
  { label: 'Thank you for the update' },
  { label: 'Can we schedule a call?' },
  { label: 'How can I support at home?' },
];

export const GuardianMessagesScreen: React.FC = () => (
  <VoiceThreadScreen
    title="Family communications"
    subtitle="Share quick feedback or voice notes with lecturers and advisors."
    quickTemplates={guardianTemplates}
    voiceCardTitle="Guardian voice note"
    voiceCardDescription="Hold to record a short note for your child's teacher. We will attach both audio and text."
    notificationRoute={{ name: 'GuardianMessages' }}
  />
);
