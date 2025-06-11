import { NextRequest, NextResponse } from "next/server";
import { sendEmailWithPdf } from "@/lib/emailService"; // ✅ only here

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      inspectorName,
      driverName,
      truckPlate,
      trailerPlate,
      inspectionDate,
      pdfBase64,
    } = body;

    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    await sendEmailWithPdf(
      inspectorName,
      pdfBuffer,
      driverName,
      truckPlate,
      trailerPlate,
      inspectionDate
    );

    return NextResponse.json({ message: "Email sent" });
  } catch (err) {
    console.error("Email error:", err);
    return NextResponse.json({ message: "Failed to send email" }, { status: 500 });
  }
}
