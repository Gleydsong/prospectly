export function expectNoSend(payload: {
  autoSend?: boolean;
  messageSent?: boolean;
  autoSendEnabled?: boolean;
}) {
  if (payload.autoSend || payload.messageSent || payload.autoSendEnabled) {
    throw new Error('Unexpected auto-send flag in assisted campaign response');
  }
}
