class NotificationService {
  constructor() {
    this.emailLogs = [];
    this.smsLogs = [];
  }

  sendEmailNotification(recipient, subject, body, alertId) {
    const logItem = {
      id: `ses_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      provider: 'Amazon SES',
      recipient: recipient || 'dispatch@flightops.aws.internal',
      subject: subject,
      body: body,
      alertId: alertId,
      sentAt: new Date().toISOString(),
      status: 'DELIVERED'
    };
    this.emailLogs.unshift(logItem);
    if (this.emailLogs.length > 50) this.emailLogs.pop();
    console.log(`✉️ [Amazon SES Email Sent] To: ${logItem.recipient} | Subject: ${subject}`);
    return logItem;
  }

  sendSMSNotification(phoneNumber, message, alertId) {
    const logItem = {
      id: `sns_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      provider: 'Amazon SNS',
      phoneNumber: phoneNumber || '+1 (555) 019-2834',
      message: message,
      alertId: alertId,
      sentAt: new Date().toISOString(),
      status: 'DELIVERED'
    };
    this.smsLogs.unshift(logItem);
    if (this.smsLogs.length > 50) this.smsLogs.pop();
    console.log(`📱 [Amazon SNS SMS Sent] To: ${logItem.phoneNumber} | Message: ${message}`);
    return logItem;
  }

  getLogs() {
    return {
      sesEmails: this.emailLogs,
      snsMessages: this.smsLogs,
      totalEmailsSent: this.emailLogs.length,
      totalSmsSent: this.smsLogs.length
    };
  }
}

module.exports = new NotificationService();
