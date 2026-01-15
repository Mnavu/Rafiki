import React from 'react';
import { VoiceThreadScreen, type QuickTemplate } from '../communications/VoiceThreadScreen';

const lecturerTemplates: QuickTemplate[] = [
  { label: 'Thanks for the update' },
  { label: 'Please check the assignment portal' },
  { label: 'Can we schedule a quick meeting?' },
];

export const LecturerMessagesScreen: React.FC = () => (
  <VoiceThreadScreen
    title="Lecturer communications"
    subtitle="Catch up on family feedback and reply with quick voice notes or templates."
    quickTemplates={lecturerTemplates}
    voiceCardTitle="Lecturer voice reply"
    voiceCardDescription="Hold to record feedback or guidance. The audio and transcript will reach the parent immediately."
    notificationRoute={{ name: 'LecturerMessages' }}
  />
);
