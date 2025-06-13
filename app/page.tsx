"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, createRef } from "react"

export default function ADRChecklist() {
  const [isMounted, setIsMounted] = useState(false)
  // State for driver and vehicle information
  const [driverName, setDriverName] = useState("")
  const [truckPlate, setTruckPlate] = useState("")
  const [trailerPlate, setTrailerPlate] = useState("")
  const [drivingLicenseDate, setDrivingLicenseDate] = useState({ month: "", year: "" })
  const [adrCertificateDate, setAdrCertificateDate] = useState({ month: "", year: "" })
  const [drivingLicenseExpired, setDrivingLicenseExpired] = useState(false)
  const [adrCertificateExpired, setAdrCertificateExpired] = useState(false)
  const [checkDate, setCheckDate] = useState("")
  const [inspectionMonth, setInspectionMonth] = useState(0)
  const [inspectionYear, setInspectionYear] = useState(0)
  const [missingItems, setMissingItems] = useState<string[]>([])
  const [showResult, setShowResult] = useState(false)
  const [allChecked, setAllChecked] = useState(false)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  const [selectedInspector, setSelectedInspector] = useState("")
  const [dateValid, setDateValid] = useState({
    drivingLicense: false,
    adrCertificate: false,
    truckDoc: false,
    trailerDoc: false,
  })
  const [truckDocDate, setTruckDocDate] = useState({ month: "", year: "" })
  const [trailerDocDate, setTrailerDocDate] = useState({ month: "", year: "" })
  const [truckDocExpired, setTruckDocExpired] = useState(false)
  const [trailerDocExpired, setTrailerDocExpired] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  // Refs for signatures and inputs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const inspectorCanvasRef = useRef<HTMLCanvasElement>(null)
  const [inspectorSignatureData, setInspectorSignatureData] = useState<string | null>(null)

  // State for checklist items
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [beforeLoadingChecked, setBeforeLoadingChecked] = useState<Record<string, boolean>>({})
  const [afterLoadingChecked, setAfterLoadingChecked] = useState<Record<string, boolean>>({})
  const [expiryDates, setExpiryDates] = useState<Record<string, { month: string; year: string }>>({})
  const [expiredItems, setExpiredItems] = useState<Record<string, boolean>>({})

  // Refs for date inputs
  const dateInputRefs = useRef<
    Record<
      string,
      {
        month: React.RefObject<HTMLInputElement>
        year: React.RefObject<HTMLInputElement>
      }
    >
  >({})
  const drivingLicenseYearRef = useRef<HTMLInputElement>(null)
  const adrCertificateYearRef = useRef<HTMLInputElement>(null)
  const truckDocYearRef = useRef<HTMLInputElement>(null)
  const trailerDocYearRef = useRef<HTMLInputElement>(null)

  // Equipment items with translations and images
  const equipmentItems = [
    {
      name: "Fire extinguisher",
      translations: [
        "de - Feuerlöscher",
        "nl - Brandblusser",
        "pl - Gaśnica",
        "ru - Огнетушитель",
        "ro - Stingător",
        "rs - Апарат за гашење",
      ],
      hasDate: true,
      image: "/images/fire-extinguisher.png",
    },
    {
      name: "Wheel chock",
      translations: [
        "de - Radkeil",
        "nl - Wieltje",
        "pl - Podkładka pod koło",
        "ru - Колодка",
        "ro - Cal pentru roți",
        "rs - Клизач",
      ],
      image: "/images/wheel-chock.png",
    },
    {
      name: "2 lamps/warning triangle",
      translations: [
        "de - 2 Lampen/Warnschild",
        "nl - 2 lampen/waarschuwingsdriehoek",
        "pl - 2 lampy/trójkąt ostrzegawczy",
        "ru - 2 фары/предупреждающий треугольник",
        "ro - 2 lampi/triunghi de avertizare",
        "rs - 2 лампе/упозоравајући троугао",
      ],
      image: "/images/warning-triangle.png",
    },
    {
      name: "Eye wash",
      translations: [
        "de - Augenspülung",
        "nl - Oogdouche",
        "pl - Płyn do przemywania oczu",
        "ru - Средство для промывания глаз",
        "ro - Soluție pentru spălarea ochilor",
        "rs - Течност за испирање очију",
      ],
      image: "/images/eye-wash.png",
    },
    {
      name: "Written ADR instructions",
      translations: [
        "de - Schriftliche ADR-Anweisungen",
        "nl - Schriftelijke ADR-instructies",
        "pl - Pisemne instrukcje ADR",
        "ru - Письменные инструкции ADR",
        "ro - Instrucțiuni ADR scrise",
        "rs - Писане упутства ADR",
      ],
      image: "/images/adr-instructions.png",
    },
    {
      name: "Shovel",
      translations: ["de - Schaufel", "nl - Schep", "pl - Łopata", "ru - Лопата", "ro - Lopată", "rs - Лопата"],
      image: "/images/shovel.png",
    },
    {
      name: "Drain seal",
      translations: [
        "de - Abflussversiegelung",
        "nl - Afvoerafdichting",
        "pl - Uszczelnienie odpływu",
        "ru - Уплотнение слива",
        "ro - Sigilant pentru scurgere",
        "rs - Бртвљење одвода",
      ],
      image: "/images/drain-seal.png",
    },
    {
      name: "Flashlight",
      translations: [
        "de - Taschenlampe",
        "nl - Zaklamp",
        "pl - Latarka",
        "ru - Фонарик",
        "ro - Lanternă",
        "rs - Батеријска лампа",
      ],
      image: "/images/flashlight.png",
    },
    {
      name: "Rubber gloves",
      translations: [
        "de - Gummihandschuhe",
        "nl - Rubber handschoenen",
        "pl - Rękawice gumowe",
        "ru - Резиновые перчатки",
        "ro - Mănuși de cauciuc",
        "rs - Гумене рукавице",
      ],
      image: "/images/rubber-gloves.png",
    },
    {
      name: "Safety glasses",
      translations: [
        "de - Schutzbrille",
        "nl - Veiligheidsbril",
        "pl - Okulary ochronne",
        "ru - Защитные очки",
        "ro - Ochelari de protecție",
        "rs - Заштитне наочаре",
      ],
      image: "/images/safety-glasses.png",
    },
    {
      name: "Mask + filter (Date for ADR class 6.1/2.3)",
      translations: [
        "de - Maske + Filter",
        "nl - Masker + filter",
        "pl - Maska + filtr",
        "ru - Маска + фильтр",
        "ro - Mastă + filtru",
        "rs - Маска + филтер",
      ],
      hasDate: true,
      image: "/images/mask-filter.png",
    },
    {
      name: "Collection bucket",
      translations: [
        "de - Auffangeimer",
        "nl - Opvangemmer",
        "pl - Wiaderko zbierające",
        "ru - Сборное ведро",
        "ro - Găleată de colectare",
        "rs - Канта за прикупљање",
      ],
      image: "/images/collection-bucket.png",
    },
  ]

  const beforeLoadingItems = [
    "ADR plate front+back",
    "Tension belts 2500DAN, 15 for FTL (Tilt trailer)",
    "No visual damages on the truck/trailer",
    "Loading security stanchions (box trailer)",
    "Tires with at least 3 mm of profile",
    "Slip mats, 40 for FTL",
    "Loading floor dry, clean, tidy, odorless",
    "Product compatibility and segregation",
  ]

  const afterLoadingItems = [
    "Goods correctly secured: This load has been secured in accordance STVO 22",
    "Doors closed/Twist locks tight",
    "Seal on right door",
    "ADR plate front + back are open",
    "Markings and Labels in Case of IMO",
  ]

  const inspectors = [
    "Eduard Tudose",
    "Angela Ilis",
    "Lucian Sistac",
    "Alexandru Dogariu",
    "Martian Gherasim",
    "Robert Kerekes",
    "Alexandru Florea",
  ]

  // Initialize canvas for signatures
  const initializeCanvas = () => {
    if (!isMounted || typeof window === "undefined") return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions to match display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // Initialize Inspector Canvas
  const initializeInspectorCanvas = () => {
    if (!isMounted || typeof window === "undefined") return

    const canvas = inspectorCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions to match display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // Signature pad implementation for driver
  const setupSignaturePad = () => {
    if (!isMounted || typeof window === "undefined") return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas style
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0047AB" // Blue pen color
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    let drawing = false
    let lastX = 0
    let lastY = 0

    const getPosition = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      let clientX, clientY

      if (e instanceof MouseEvent) {
        clientX = e.clientX
        clientY = e.clientY
      } else {
        // Handle touch events properly
        e.preventDefault()
        const touch = e.touches[0] || e.changedTouches[0]
        clientX = touch.clientX
        clientY = touch.clientY
      }

      // Calculate position considering canvas scaling
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    }

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      drawing = true
      const pos = getPosition(e)
      lastX = pos.x
      lastY = pos.y
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!drawing) return
      e.preventDefault()

      const pos = getPosition(e)
      const currentX = pos.x
      const currentY = pos.y

      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(currentX, currentY)
      ctx.stroke()

      lastX = currentX
      lastY = currentY
    }

    const stopDrawing = (e: MouseEvent | TouchEvent) => {
      if (e) e.preventDefault()
      drawing = false
      setSignatureData(canvas.toDataURL("image/png"))
    }

    // Mouse events
    canvas.addEventListener("mousedown", startDrawing)
    canvas.addEventListener("mousemove", draw)
    canvas.addEventListener("mouseup", stopDrawing)
    canvas.addEventListener("mouseout", stopDrawing)

    // Touch events with proper settings
    canvas.addEventListener("touchstart", startDrawing, { passive: false })
    canvas.addEventListener("touchmove", draw, { passive: false })
    canvas.addEventListener("touchend", stopDrawing, { passive: false })
    canvas.addEventListener("touchcancel", stopDrawing, { passive: false })

    return () => {
      // Cleanup for driver signature
      canvas.removeEventListener("mousedown", startDrawing)
      canvas.removeEventListener("mousemove", draw)
      canvas.removeEventListener("mouseup", stopDrawing)
      canvas.removeEventListener("mouseout", stopDrawing)

      canvas.removeEventListener("touchstart", startDrawing)
      canvas.removeEventListener("touchmove", draw)
      canvas.removeEventListener("touchend", stopDrawing)
      canvas.removeEventListener("touchcancel", stopDrawing)
    }
  }

  // Signature pad implementation for inspector
  const setupInspectorSignaturePad = () => {
    if (!isMounted || typeof window === "undefined") return

    const canvas = inspectorCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas style
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0047AB" // Blue pen color
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    let drawing = false
    let lastX = 0
    let lastY = 0

    const getPosition = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      let clientX, clientY

      if (e instanceof MouseEvent) {
        clientX = e.clientX
        clientY = e.clientY
      } else {
        // Handle touch events properly
        e.preventDefault()
        const touch = e.touches[0] || e.changedTouches[0]
        clientX = touch.clientX
        clientY = touch.clientY
      }

      // Calculate position considering canvas scaling
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    }

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      drawing = true
      const pos = getPosition(e)
      lastX = pos.x
      lastY = pos.y
    }

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!drawing) return
      e.preventDefault()

      const pos = getPosition(e)
      const currentX = pos.x
      const currentY = pos.y

      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(currentX, currentY)
      ctx.stroke()

      lastX = currentX
      lastY = currentY
    }

    const stopDrawing = (e: MouseEvent | TouchEvent) => {
      if (e) e.preventDefault()
      drawing = false
      setInspectorSignatureData(canvas.toDataURL("image/png"))
    }

    // Mouse events
    canvas.addEventListener("mousedown", startDrawing)
    canvas.addEventListener("mousemove", draw)
    canvas.addEventListener("mouseup", stopDrawing)
    canvas.addEventListener("mouseout", stopDrawing)

    // Touch events with proper settings
    canvas.addEventListener("touchstart", startDrawing, { passive: false })
    canvas.addEventListener("touchmove", draw, { passive: false })
    canvas.addEventListener("touchend", stopDrawing, { passive: false })
    canvas.addEventListener("touchcancel", stopDrawing, { passive: false })

    return () => {
      canvas.removeEventListener("mousedown", startDrawing)
      canvas.removeEventListener("mousemove", draw)
      canvas.removeEventListener("mouseup", stopDrawing)
      canvas.removeEventListener("mouseout", stopDrawing)

      canvas.removeEventListener("touchstart", startDrawing)
      canvas.removeEventListener("touchmove", draw)
      canvas.removeEventListener("touchend", stopDrawing)
      canvas.removeEventListener("touchcancel", stopDrawing)
    }
  }

  // Clear signatures
  const clearSignature = () => {
    if (!isMounted || typeof window === "undefined") return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setSignatureData(null)
  }

  const clearInspectorSignature = () => {
    if (!isMounted || typeof window === "undefined") return

    const canvas = inspectorCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setInspectorSignatureData(null)
  }

  // Check if a date is expired
  const checkIfDateIsExpired = (itemName: string) => {
    const dateObj = expiryDates[itemName]
    if (!dateObj || !dateObj.month || !dateObj.year) {
      return false
    }

    const expiryMonth = Number.parseInt(dateObj.month, 10)
    const expiryYear = Number.parseInt(dateObj.year, 10)

    if (isNaN(expiryMonth) || isNaN(expiryYear) || expiryMonth < 1 || expiryMonth > 12 || expiryYear < 1000) {
      return false
    }

    const isExpired = expiryYear < inspectionYear || (expiryYear === inspectionYear && expiryMonth < inspectionMonth)

    setExpiredItems((prev) => ({
      ...prev,
      [itemName]: isExpired,
    }))

    setCheckedItems((prev) => ({
      ...prev,
      [itemName]: !isExpired,
    }))

    return isExpired
  }

  // Function to download PDF without sending email
  const downloadPDF = async () => {
    if (!isMounted || typeof window === "undefined") return

    setIsPdfGenerating(true)

    try {
      // Dynamically import jsPDF only on client side
      const { jsPDF } = await import("jspdf")

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let y = 20

      // Load watermark image
      const watermarkUrl = "/images/albias-watermark.png"
      const watermarkImage = await fetch(watermarkUrl)
        .then((res) => res.blob())
        .then((blob) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        })

      // Draw watermark (centered and semi-transparent)
      pdf.addImage(watermarkImage, "PNG", pageWidth / 2 - 50, pageHeight / 2 - 50, 100, 100, undefined, "NONE", 0.1)

      const inspectorColors = {
        "Alexandru Dogariu": "#FF8C00",
        "Robert Kerekes": "#8B4513",
        "Eduard Tudose": "#000000",
        "Angela Ilis": "#FF69B4",
        "Lucian Sistac": "#1E90FF",
        "Martian Gherasim": "#008000",
        "Alexandru Florea": "#DAA520",
      }

      const drawCheckbox = (x: number, y: number, checked: boolean) => {
        pdf.setDrawColor(0)
        pdf.setLineWidth(0.5)
        pdf.rect(x, y, 4, 4)
        if (checked) {
          pdf.setDrawColor(0, 100, 0)
          pdf.setLineWidth(0.8)
          pdf.line(x + 0.5, y + 2, x + 1.5, y + 3.2)
          pdf.line(x + 1.5, y + 3.2, x + 3.5, y + 0.8)
        } else {
          pdf.setDrawColor(255, 0, 0)
          pdf.setLineWidth(0.8)
          pdf.line(x, y, x + 4, y + 4)
          pdf.line(x + 4, y, x, y + 4)
        }
        pdf.setDrawColor(0)
        pdf.setLineWidth(0.5)
      }

      const addSafeText = (text: string, x: number, y: number, options = {}, color = "#000000") => {
        pdf.setTextColor(color)
        pdf.setFont("helvetica", "bold")
        pdf.text(text, x, y, options)
        pdf.setTextColor("#000000")
      }

      const addLine = (text: string, value: string, x: number, y: number, color = "#000000") => {
        const label = `${text} `
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor("#000000")
        pdf.text(label, x, y)
        const labelWidth = pdf.getTextWidth(label)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(color)
        pdf.text(value, x + labelWidth, y)
        pdf.setTextColor("#000000")
      }

      pdf.setFontSize(18)
      addSafeText("ADR Checklist", pageWidth / 2, y, { align: "center" })
      y += 10

      pdf.setFontSize(10)

      const lines = [
        { label: "Driver's Name:", value: driverName, color: "#191970" },
        { label: "Truck License Plate:", value: truckPlate, color: "#191970" },
        { label: "Trailer License Plate:", value: trailerPlate, color: "#191970" },
      ]

      if (drivingLicenseDate.month && drivingLicenseDate.year) {
        const expired = drivingLicenseExpired
        lines.push({
          label: "Driving License Expiry:",
          value: `${drivingLicenseDate.month}/${drivingLicenseDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      if (adrCertificateDate.month && adrCertificateDate.year) {
        const expired = adrCertificateExpired
        lines.push({
          label: "ADR Certificate Expiry:",
          value: `${adrCertificateDate.month}/${adrCertificateDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      if (truckDocDate.month && truckDocDate.year) {
        const expired = truckDocExpired
        lines.push({
          label: "Truck Document Expiry:",
          value: `${truckDocDate.month}/${truckDocDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      if (trailerDocDate.month && trailerDocDate.year) {
        const expired = trailerDocExpired
        lines.push({
          label: "Trailer Document Expiry:",
          value: `${trailerDocDate.month}/${trailerDocDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      lines.push({ label: "Inspection Date:", value: checkDate, color: "#191970" })

      lines.forEach(({ label, value, color }) => {
        addLine(label, value, margin, y, color)
        y += 6
      })

      y += 4
      addSafeText("Equipment Checklist", margin, y)
      y += 6

      const leftColumnItems = equipmentItems.slice(0, 6)
      const rightColumnItems = equipmentItems.slice(6)
      const columnGap = 10
      const leftX = margin
      const rightX = pageWidth / 2 + columnGap
      const columnHeight = Math.max(leftColumnItems.length, rightColumnItems.length)
      const rowHeight = 8

      for (let i = 0; i < columnHeight; i++) {
        const currentY = y + i * rowHeight

        const renderItem = (item: any, x: number) => {
          if (!item) return
          const isChecked = checkedItems[item.name]
          const date = expiryDates[item.name]
          let label = item.name

          if (item.hasDate && date?.month && date?.year) {
            const now = new Date()
            const expiry = new Date(`${date.year}-${date.month}-01`)
            expiry.setMonth(expiry.getMonth() + 1)
            expiry.setDate(0)
            const expired = now > expiry
            const dateStr = `${date.month}/${date.year}${expired ? " (EXPIRED)" : ""}`
            label = `${item.name} - `
            drawCheckbox(x, currentY - 3, isChecked && !expired)

            addSafeText(label, x + 6, currentY)
            addSafeText(dateStr, x + 6 + pdf.getTextWidth(label), currentY, {}, expired ? "#FF0000" : "#006400")
            return
          }

          drawCheckbox(x, currentY - 3, isChecked)
          addSafeText(label, x + 6, currentY)
        }

        renderItem(leftColumnItems[i], leftX)
        renderItem(rightColumnItems[i], rightX)
      }

      y += columnHeight * rowHeight + 10
      addSafeText("Before Loading", margin, y)
      y += 6
      beforeLoadingItems.forEach((item) => {
        drawCheckbox(margin, y - 3, beforeLoadingChecked[item])
        addSafeText(item, margin + 6, y)
        y += 6
      })

      y += 4
      addSafeText("After Loading", margin, y)
      y += 6
      afterLoadingItems.forEach((item) => {
        drawCheckbox(margin, y - 3, afterLoadingChecked[item])
        addSafeText(item, margin + 6, y)
        y += 6
      })

      y += 10

      if (signatureData) {
        pdf.addImage(signatureData, "PNG", margin, y, 70, 20)
        addSafeText("Driver Signature", margin, y + 25)
      } else {
        pdf.setDrawColor(0, 71, 171) // Blue color (RGB)
        pdf.setLineWidth(0.8)
        pdf.line(margin, y + 20, margin + 70, y + 20)
        addSafeText("Driver Signature (Not Signed)", margin, y + 25)
      }

      const inspectorX = pageWidth - margin - 70
      if (inspectorSignatureData) {
        pdf.addImage(inspectorSignatureData, "PNG", inspectorX, y, 70, 20)
      } else {
        pdf.setDrawColor(0, 71, 171) // Blue color (RGB)
        pdf.setLineWidth(0.8)
        pdf.line(inspectorX, y + 20, inspectorX + 70, y + 20)
      }

      const inspectorColor = inspectorColors[selectedInspector] || "#000000"
      const inspectorLabel = "Inspector: "
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor("#000000")
      pdf.text(inspectorLabel, inspectorX, y + 25)
      const labelWidth = pdf.getTextWidth(inspectorLabel)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(inspectorColor)
      pdf.text(selectedInspector || "Not selected", inspectorX + labelWidth, y + 25)

      // Save the PDF for download
      const fileName = `ADR-Check_${driverName.replace(/\s+/g, "_")}_${checkDate.replace(/-/g, ".")}.pdf`
      pdf.save(fileName)
    } catch (err: any) {
      console.error(err)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setIsPdfGenerating(false)
    }
  }

  // Function to handle sending email with PDF
  const handleSendEmail = async () => {
    setIsSendingEmail(true)
    setEmailStatus(null)

    try {
      // Dynamically import jsPDF only on client side
      const { jsPDF } = await import("jspdf")

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let y = 20

      // Load watermark image
      const watermarkUrl = "/images/albias-watermark.png"
      const watermarkImage = await fetch(watermarkUrl)
        .then((res) => res.blob())
        .then((blob) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        })

      // Draw watermark (centered and semi-transparent)
      pdf.addImage(watermarkImage, "PNG", pageWidth / 2 - 50, pageHeight / 2 - 50, 100, 100, undefined, "NONE", 0.1)

      const inspectorColors = {
        "Alexandru Dogariu": "#FF8C00",
        "Robert Kerekes": "#8B4513",
        "Eduard Tudose": "#000000",
        "Angela Ilis": "#FF69B4",
        "Lucian Sistac": "#1E90FF",
        "Martian Gherasim": "#008000",
        "Alexandru Florea": "#DAA520",
      }

      const drawCheckbox = (x: number, y: number, checked: boolean) => {
        pdf.setDrawColor(0)
        pdf.setLineWidth(0.5)
        pdf.rect(x, y, 4, 4)
        if (checked) {
          pdf.setDrawColor(0, 100, 0)
          pdf.setLineWidth(0.8)
          pdf.line(x + 0.5, y + 2, x + 1.5, y + 3.2)
          pdf.line(x + 1.5, y + 3.2, x + 3.5, y + 0.8)
        } else {
          pdf.setDrawColor(255, 0, 0)
          pdf.setLineWidth(0.8)
          pdf.line(x, y, x + 4, y + 4)
          pdf.line(x + 4, y, x, y + 4)
        }
        pdf.setDrawColor(0)
        pdf.setLineWidth(0.5)
      }

      const addSafeText = (text: string, x: number, y: number, options = {}, color = "#000000") => {
        pdf.setTextColor(color)
        pdf.setFont("helvetica", "bold")
        pdf.text(text, x, y, options)
        pdf.setTextColor("#000000")
      }

      const addLine = (text: string, value: string, x: number, y: number, color = "#000000") => {
        const label = `${text} `
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor("#000000")
        pdf.text(label, x, y)
        const labelWidth = pdf.getTextWidth(label)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor(color)
        pdf.text(value, x + labelWidth, y)
        pdf.setTextColor("#000000")
      }

      pdf.setFontSize(18)
      addSafeText("ADR Checklist", pageWidth / 2, y, { align: "center" })
      y += 10

      pdf.setFontSize(10)

      const lines = [
        { label: "Driver's Name:", value: driverName, color: "#191970" },
        { label: "Truck License Plate:", value: truckPlate, color: "#191970" },
        { label: "Trailer License Plate:", value: trailerPlate, color: "#191970" },
      ]

      if (drivingLicenseDate.month && drivingLicenseDate.year) {
        const expired = drivingLicenseExpired
        lines.push({
          label: "Driving License Expiry:",
          value: `${drivingLicenseDate.month}/${drivingLicenseDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      if (adrCertificateDate.month && adrCertificateDate.year) {
        const expired = adrCertificateExpired
        lines.push({
          label: "ADR Certificate Expiry:",
          value: `${adrCertificateDate.month}/${adrCertificateDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      if (truckDocDate.month && truckDocDate.year) {
        const expired = truckDocExpired
        lines.push({
          label: "Truck Document Expiry:",
          value: `${truckDocDate.month}/${truckDocDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      if (trailerDocDate.month && trailerDocDate.year) {
        const expired = trailerDocExpired
        lines.push({
          label: "Trailer Document Expiry:",
          value: `${trailerDocDate.month}/${trailerDocDate.year}${expired ? " (EXPIRED)" : ""}`,
          color: expired ? "#FF0000" : "#006400",
        })
      }

      lines.push({ label: "Inspection Date:", value: checkDate, color: "#191970" })

      lines.forEach(({ label, value, color }) => {
        addLine(label, value, margin, y, color)
        y += 6
      })

      y += 4
      addSafeText("Equipment Checklist", margin, y)
      y += 6

      const leftColumnItems = equipmentItems.slice(0, 6)
      const rightColumnItems = equipmentItems.slice(6)
      const columnGap = 10
      const leftX = margin
      const rightX = pageWidth / 2 + columnGap
      const columnHeight = Math.max(leftColumnItems.length, rightColumnItems.length)
      const rowHeight = 8

      for (let i = 0; i < columnHeight; i++) {
        const currentY = y + i * rowHeight

        const renderItem = (item: any, x: number) => {
          if (!item) return
          const isChecked = checkedItems[item.name]
          const date = expiryDates[item.name]
          let label = item.name

          if (item.hasDate && date?.month && date?.year) {
            const now = new Date()
            const expiry = new Date(`${date.year}-${date.month}-01`)
            expiry.setMonth(expiry.getMonth() + 1)
            expiry.setDate(0)
            const expired = now > expiry
            const dateStr = `${date.month}/${date.year}${expired ? " (EXPIRED)" : ""}`
            label = `${item.name} - `
            drawCheckbox(x, currentY - 3, isChecked && !expired)

            addSafeText(label, x + 6, currentY)
            addSafeText(dateStr, x + 6 + pdf.getTextWidth(label), currentY, {}, expired ? "#FF0000" : "#006400")
            return
          }

          drawCheckbox(x, currentY - 3, isChecked)
          addSafeText(label, x + 6, currentY)
        }

        renderItem(leftColumnItems[i], leftX)
        renderItem(rightColumnItems[i], rightX)
      }

      y += columnHeight * rowHeight + 10
      addSafeText("Before Loading", margin, y)
      y += 6
      beforeLoadingItems.forEach((item) => {
        drawCheckbox(margin, y - 3, beforeLoadingChecked[item])
        addSafeText(item, margin + 6, y)
        y += 6
      })

      y += 4
      addSafeText("After Loading", margin, y)
      y += 6
      afterLoadingItems.forEach((item) => {
        drawCheckbox(margin, y - 3, afterLoadingChecked[item])
        addSafeText(item, margin + 6, y)
        y += 6
      })

      y += 10

      if (signatureData) {
        pdf.addImage(signatureData, "PNG", margin, y, 70, 20)
        addSafeText("Driver Signature", margin, y + 25)
      } else {
        pdf.setDrawColor(0, 71, 171) // Blue color (RGB)
        pdf.setLineWidth(0.8)
        pdf.line(margin, y + 20, margin + 70, y + 20)
        addSafeText("Driver Signature (Not Signed)", margin, y + 25)
      }

      const inspectorX = pageWidth - margin - 70
      if (inspectorSignatureData) {
        pdf.addImage(inspectorSignatureData, "PNG", inspectorX, y, 70, 20)
      } else {
        pdf.setDrawColor(0, 71, 171) // Blue color (RGB)
        pdf.setLineWidth(0.8)
        pdf.line(inspectorX, y + 20, inspectorX + 70, y + 20)
      }

      const inspectorColor = inspectorColors[selectedInspector] || "#000000"
      const inspectorLabel = "Inspector: "
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor("#000000")
      pdf.text(inspectorLabel, inspectorX, y + 25)
      const labelWidth = pdf.getTextWidth(inspectorLabel)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(inspectorColor)
      pdf.text(selectedInspector || "Not selected", inspectorX + labelWidth, y + 25)

      // Get PDF as base64
      const pdfBuffer = pdf.output("arraybuffer")
      const pdfBase64 = Buffer.from(pdfBuffer).toString("base64")

      // Send email
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectorName: selectedInspector,
          pdfBase64: pdfBase64,
          driverName,
          truckPlate,
          trailerPlate,
          inspectionDate: checkDate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to send email")
      }

      if (data.success) {
        let successMessage = "Email sent successfully!"
        if (data.driveLink) {
          successMessage += " PDF was also saved to Google Drive."
        }
        setEmailStatus(successMessage)
        // Reset form after successful email
        resetForm()
      } else {
        setEmailStatus(data.message || "Email sent successfully!")
      }
    } catch (err: any) {
      console.error(err)
      setEmailStatus("Failed to send email. Please try again.")
    } finally {
      setIsSendingEmail(false)
    }
  }

  const resetForm = useCallback(() => {
    setDriverName("")
    setTruckPlate("")
    setTrailerPlate("")
    setDrivingLicenseDate({ month: "", year: "" })
    setAdrCertificateDate({ month: "", year: "" })
    setTruckDocDate({ month: "", year: "" })
    setTrailerDocDate({ month: "", year: "" })
    setDrivingLicenseExpired(false)
    setAdrCertificateExpired(false)
    setTruckDocExpired(false)
    setTrailerDocExpired(false)
    setDateValid({
      drivingLicense: false,
      adrCertificate: false,
      truckDoc: false,
      trailerDoc: false,
    })

    // Reset equipment items
    const resetEquipmentState: Record<string, boolean> = {}
    equipmentItems.forEach((item) => {
      resetEquipmentState[item.name] = false
    })
    setCheckedItems(resetEquipmentState)

    // Reset before loading items
    const resetBeforeLoadingState: Record<string, boolean> = {}
    beforeLoadingItems.forEach((item) => {
      resetBeforeLoadingState[item] = false
    })
    setBeforeLoadingChecked(resetBeforeLoadingState)

    // Reset after loading items
    const resetAfterLoadingState: Record<string, boolean> = {}
    afterLoadingItems.forEach((item) => {
      resetAfterLoadingState[item] = false
    })
    setAfterLoadingChecked(resetAfterLoadingState)

    // Reset expiry dates
    const resetDates: Record<string, { month: string; year: string }> = {}
    const resetExpiredItems: Record<string, boolean> = {}
    equipmentItems.forEach((item) => {
      if (item.hasDate) {
        resetDates[item.name] = { month: "", year: "" }
        resetExpiredItems[item.name] = false
      }
    })
    setExpiryDates(resetDates)
    setExpiredItems(resetExpiredItems)

    // Reset signatures
    clearSignature()
    clearInspectorSignature()

    // Reset inspector
    setSelectedInspector("")

    // Reset other states
    setShowResult(false)
    setMissingItems([])
    setAllChecked(false)

    // Clear localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("adrChecklistData")
    }
  }, [equipmentItems, beforeLoadingItems, afterLoadingItems])

  // Initialize component
  useEffect(() => {
    setIsMounted(true)

    // Set today's date and inspection info
    const today = new Date()
    const day = String(today.getDate()).padStart(2, "0")
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const year = today.getFullYear()

    setCheckDate(`${day}-${month}-${year}`)
    setInspectionMonth(today.getMonth() + 1)
    setInspectionYear(today.getFullYear())

    // Initialize equipment items
    const initialEquipmentState: Record<string, boolean> = {}
    equipmentItems.forEach((item) => {
      initialEquipmentState[item.name] = false
    })
    setCheckedItems(initialEquipmentState)

    const initialBeforeLoadingState: Record<string, boolean> = {}
    beforeLoadingItems.forEach((item) => {
      initialBeforeLoadingState[item] = false
    })
    setBeforeLoadingChecked(initialBeforeLoadingState)

    const initialAfterLoadingState: Record<string, boolean> = {}
    afterLoadingItems.forEach((item) => {
      initialAfterLoadingState[item] = false
    })
    setAfterLoadingChecked(initialAfterLoadingState)

    // Initialize expiry date refs and states
    const initialDates: Record<string, { month: string; year: string }> = {}
    const initialExpiredItems: Record<string, boolean> = {}

    equipmentItems.forEach((item) => {
      if (item.hasDate) {
        initialDates[item.name] = { month: "", year: "" }
        initialExpiredItems[item.name] = false
        dateInputRefs.current[item.name] = {
          month: createRef<HTMLInputElement>(),
          year: createRef<HTMLInputElement>(),
        }
      }
    })

    setExpiryDates(initialDates)
    setExpiredItems(initialExpiredItems)
  }, [])

  // Effect for canvas initialization
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return

    // Initialize signature canvases
    initializeCanvas()
    initializeInspectorCanvas()

    const cleanupDriver = setupSignaturePad()
    const cleanupInspector = setupInspectorSignaturePad()

    // ✨ Title fade-in animation
    const title = document.getElementById("adr-title")
    if (title) {
      title.style.opacity = "0"
      title.style.transform = "translateY(-10px)"
      setTimeout(() => {
        title.style.transition = "all 0.6s ease-out"
        title.style.opacity = "1"
        title.style.transform = "translateY(0)"
      }, 200)
    }

    // Cleanup event listeners on unmount
    return () => {
      if (cleanupDriver) cleanupDriver()
      if (cleanupInspector) cleanupInspector()
    }
  }, [isMounted])

  // Add this right after the return statement
  if (!isMounted) {
    return (
      <div className="container mx-auto py-4 max-w-4xl relative z-30 bg-white bg-opacity-90 rounded-lg shadow-lg my-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Loading ADR Checklist...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-4 max-w-4xl relative z-30 bg-white bg-opacity-90 rounded-lg shadow-lg my-8">
      <div className="text-center mb-6">
        <h1 id="adr-title" className="text-2xl font-bold">
          ADR Equipment Checklist
        </h1>
        <p className="text-gray-600 mt-2">Verify all required ADR equipment before transport</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Driver & Vehicle Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="driverName" className="block text-sm font-medium text-gray-700 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                id="driverName"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-blue-200 focus:outline-none"
                placeholder="Enter driver name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="truckPlate" className="block text-sm font-medium text-gray-700 mb-1">
                  Truck License Plate
                </label>
                <input
                  type="text"
                  id="truckPlate"
                  value={truckPlate}
                  onChange={(e) => setTruckPlate(e.target.value.toUpperCase())}
                  className="w-full p-2 border rounded focus:ring focus:ring-blue-200 focus:outline-none"
                  placeholder="e.g. AB-123-CD"
                />
              </div>
              <div>
                <label htmlFor="trailerPlate" className="block text-sm font-medium text-gray-700 mb-1">
                  Trailer License Plate
                </label>
                <input
                  type="text"
                  id="trailerPlate"
                  value={trailerPlate}
                  onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
                  className="w-full p-2 border rounded focus:ring focus:outline-none"
                  placeholder="e.g. XY-789-ZW"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Document Expiry Dates</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driving License Expiry</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="MM"
                    maxLength={2}
                    value={drivingLicenseDate.month}
                    onChange={(e) => setDrivingLicenseDate({ ...drivingLicenseDate, month: e.target.value })}
                    className={`w-full p-2 border rounded focus:ring focus:outline-none ${
                      drivingLicenseExpired ? "border-red-500 bg-red-50" : ""
                    }`}
                  />
                  <span className="flex items-center">/</span>
                  <input
                    type="text"
                    placeholder="YYYY"
                    maxLength={4}
                    value={drivingLicenseDate.year}
                    onChange={(e) => setDrivingLicenseDate({ ...drivingLicenseDate, year: e.target.value })}
                    ref={drivingLicenseYearRef}
                    className={`w-full p-2 border rounded focus:ring focus:outline-none ${
                      drivingLicenseExpired ? "border-red-500 bg-red-50" : ""
                    }`}
                  />
                </div>
                {drivingLicenseExpired && <p className="text-red-500 text-xs mt-1">License expired!</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ADR Certificate Expiry</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="MM"
                    maxLength={2}
                    value={adrCertificateDate.month}
                    onChange={(e) => setAdrCertificateDate({ ...adrCertificateDate, month: e.target.value })}
                    className={`w-full p-2 border rounded focus:ring focus:outline-none ${
                      adrCertificateExpired ? "border-red-500 bg-red-50" : ""
                    }`}
                  />
                  <span className="flex items-center">/</span>
                  <input
                    type="text"
                    placeholder="YYYY"
                    maxLength={4}
                    value={adrCertificateDate.year}
                    onChange={(e) => setAdrCertificateDate({ ...adrCertificateDate, year: e.target.value })}
                    ref={adrCertificateYearRef}
                    className={`w-full p-2 border rounded focus:ring focus:outline-none ${
                      adrCertificateExpired ? "border-red-500 bg-red-50" : ""
                    }`}
                  />
                </div>
                {adrCertificateExpired && <p className="text-red-500 text-xs mt-1">Certificate expired!</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 border-b pb-4 relative bg-white overflow-hidden">
        <h2 className="text-lg font-semibold mb-4">Inspector Signature</h2>
        <div className="mb-4">
          <label htmlFor="inspector" className="block text-sm font-medium text-gray-700 mb-1">
            Select Inspector
          </label>
          <select
            id="inspector"
            value={selectedInspector}
            onChange={(e) => setSelectedInspector(e.target.value)}
            className="w-full p-2 border rounded focus:ring focus:ring-blue-200 focus:outline-none"
          >
            <option value="">Select an inspector...</option>
            {inspectors.map((inspector) => (
              <option key={inspector} value={inspector}>
                {inspector}
              </option>
            ))}
          </select>
        </div>
        <div className="border rounded-lg overflow-hidden bg-gray-50 mb-2">
          <canvas ref={inspectorCanvasRef} className="w-full h-32 touch-none" style={{ touchAction: "none" }}></canvas>
        </div>
        <button onClick={clearInspectorSignature} className="text-sm text-blue-600 hover:text-blue-800" type="button">
          Clear Signature
        </button>
      </div>

      <div className="mb-8 border-b pb-4 relative bg-white overflow-hidden">
        <h2 className="text-lg font-semibold mb-4">Driver Signature</h2>
        <div className="border rounded-lg overflow-hidden bg-gray-50 mb-2">
          <canvas ref={canvasRef} className="w-full h-32 touch-none" style={{ touchAction: "none" }}></canvas>
        </div>
        <button onClick={clearSignature} className="text-sm text-blue-600 hover:text-blue-800" type="button">
          Clear Signature
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mt-8">
        <button
          onClick={downloadPDF}
          disabled={isPdfGenerating}
          className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {isPdfGenerating ? "Generating PDF..." : "Download PDF"}
        </button>
        <button
          onClick={handleSendEmail}
          disabled={isSendingEmail || !selectedInspector}
          className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
        >
          {isSendingEmail ? "Sending..." : "Send PDF via Email"}
        </button>
      </div>

      {emailStatus && <div className="mt-4 p-3 bg-green-100 text-green-800 rounded">{emailStatus}</div>}
    </div>
  )
}
