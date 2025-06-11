// emailService.ts
import nodemailer from 'nodemailer';
import { emailConfig, inspectorEmails } from './emailConfig';

const transporter = nodemailer.createTransport(emailConfig);

export async function sendEmailWithPdf(
  inspectorName: string,
  pdfBuffer: Buffer,
  driverName: string,
  truckPlate: string,
  trailerPlate: string,
  inspectionDate: string
) {
  const recipients = inspectorEmails[inspectorName] || [];
  
  if (recipients.length === 0) {
    throw new Error('No email recipients found for this inspector');
  }

  const mailOptions = {
    from: emailConfig.auth.user,
    to: recipients.join(', '),
    subject: `ADR Checklist for ${driverName} - ${truckPlate}/${trailerPlate}`,
    text: `Please find attached the ADR Checklist for driver ${driverName} (Truck: ${truckPlate}, Trailer: ${trailerPlate}) inspected on ${inspectionDate}.`,
    attachments: [
      {
        filename: `ADR_Checklist_${driverName}_${truckPlate}_${trailerPlate}.pdf`,
        content: pdfBuffer,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}
