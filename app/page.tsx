"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, createRef } from "react"

const capitalizeWords = (str: string) =>
  str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")

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
  const [showFtpModal, setShowFtpModal] = useState(false)
  const [orderNumber, setOrderNumber] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
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
      name: "Mask + filter (ADR class 6.1/2.3)",
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
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#000"
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
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#000"
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

  // Handle date changes for licenses/certificates
  const handleLicenseDateChange = (
    type: "drivingLicense" | "adrCertificate",
    field: "month" | "year",
    value: string,
  ) => {
    const numericValue = value.replace(/[^0-9]/g, "")

    const updateState = (updated: { month: string; year: string }) => {
      if (type === "drivingLicense") {
        setDrivingLicenseDate(updated)
      } else {
        setAdrCertificateDate(updated)
      }
    }

    const current = type === "drivingLicense" ? drivingLicenseDate : adrCertificateDate
    const updatedDate = { ...current, [field]: numericValue }
    updateState(updatedDate)

    if (field === "month" && numericValue.length === 2) {
      ;(type === "drivingLicense" ? drivingLicenseYearRef : adrCertificateYearRef).current?.focus()
    }

    if (updatedDate.month.length === 2 && updatedDate.year.length === 4) {
      const month = Number.parseInt(updatedDate.month, 10)
      const year = Number.parseInt(updatedDate.year, 10)
      const isExpired = year < inspectionYear || (year === inspectionYear && month < inspectionMonth)

      if (type === "drivingLicense") {
        setDrivingLicenseExpired(isExpired)
        setDateValid((prev) => ({ ...prev, drivingLicense: !isExpired }))
      } else {
        setAdrCertificateExpired(isExpired)
        setDateValid((prev) => ({ ...prev, adrCertificate: !isExpired }))
      }
    }
  }

  // Handle equipment expiry date changes
  const handleExpiryDateChange = (itemName: string, field: "month" | "year", value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "")

    if (field === "month" && numericValue.length > 0) {
      const monthNum = Number.parseInt(numericValue, 10)
      if (monthNum > 12) return
    }

    setExpiryDates((prev) => {
      const updatedDates = {
        ...prev,
        [itemName]: {
          ...prev[itemName],
          [field]: numericValue,
        },
      }

      const allFieldsFilled = field === "year" && numericValue.length === 4 && updatedDates[itemName].month.length > 0

      if (allFieldsFilled) {
        setTimeout(() => {
          const expiryMonth = Number.parseInt(updatedDates[itemName].month, 10)
          const expiryYear = Number.parseInt(numericValue, 10)

          if (
            !isNaN(expiryMonth) &&
            !isNaN(expiryYear) &&
            expiryMonth >= 1 &&
            expiryMonth <= 12 &&
            expiryYear >= 1000
          ) {
            const isExpired =
              expiryYear < inspectionYear || (expiryYear === inspectionYear && expiryMonth < inspectionMonth)

            setExpiredItems((prev) => ({
              ...prev,
              [itemName]: isExpired,
            }))

            setCheckedItems((prev) => ({
              ...prev,
              [itemName]: !isExpired,
            }))
          }
        }, 0)
      }

      return updatedDates
    })

    if (field === "month" && numericValue.length === 2) {
      dateInputRefs.current[itemName]?.year.current?.focus()
    }
  }

  const handleTruckDocDateChange = (field: "month" | "year", value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "")
    const updatedDate = { ...truckDocDate, [field]: numericValue }
    setTruckDocDate(updatedDate)

    if (field === "month" && numericValue.length === 2) {
      truckDocYearRef.current?.focus()
    }

    if (updatedDate.month.length === 2 && updatedDate.year.length === 4) {
      const month = Number.parseInt(updatedDate.month, 10)
      const year = Number.parseInt(updatedDate.year, 10)
      const isExpired = year < inspectionYear || (year === inspectionYear && month < inspectionMonth)
      setTruckDocExpired(isExpired)
      setDateValid((prev) => ({ ...prev, truckDoc: !isExpired }))
    }
  }

  const handleTrailerDocDateChange = (field: "month" | "year", value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "")
    const updatedDate = { ...trailerDocDate, [field]: numericValue }
    setTrailerDocDate(updatedDate)

    if (field === "month" && numericValue.length === 2) {
      trailerDocYearRef.current?.focus()
    }

    if (updatedDate.month.length === 2 && updatedDate.year.length === 4) {
      const month = Number.parseInt(updatedDate.month, 10)
      const year = Number.parseInt(updatedDate.year, 10)
      const isExpired = year < inspectionYear || (year === inspectionYear && month < inspectionMonth)
      setTrailerDocExpired(isExpired)
      setDateValid((prev) => ({ ...prev, trailerDoc: !isExpired }))
    }
  }

  // Handle equipment checkbox changes
  const handleEquipmentCheck = (itemName: string, checked: boolean) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemName]: checked,
    }))
  }

  // Handle before loading checklist changes
  const handleBeforeLoadingCheck = (itemName: string, checked: boolean) => {
    setBeforeLoadingChecked((prev) => ({
      ...prev,
      [itemName]: checked,
    }))
  }

  // Handle after loading checklist changes
  const handleAfterLoadingCheck = (itemName: string, checked: boolean) => {
    setAfterLoadingChecked((prev) => ({
      ...prev,
      [itemName]: checked,
    }))
  }

  // Check for missing items
  const checkMissingItems = () => {
    const missing: string[] = []

    Object.entries(checkedItems).forEach(([item, checked]) => {
      if (!checked) {
        missing.push(item)
      }
    })

    setMissingItems(missing)
    setShowResult(true)
    setAllChecked(missing.length === 0)
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

  // Generate PDF report
  const generatePDF = async () => {
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
      try {
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
      } catch (watermarkError) {
        console.error("Error adding watermark:", watermarkError)
        // Continue without watermark
      }

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
        pdf.setLineWidth(0.5)
        pdf.line(margin, y + 20, margin + 70, y + 20)
        addSafeText("Driver Signature (Not Signed)", margin, y + 25)
      }

      const inspectorX = pageWidth - margin - 70
      if (inspectorSignatureData) {
        pdf.addImage(inspectorSignatureData, "PNG", inspectorX, y, 70, 20)
      } else {
        pdf.setLineWidth(0.5)
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

      // Save the PDF for download only (no email or Google Drive)
      pdf.save(`ADR-Check_${driverName.replace(/\s+/g, "_")}_${checkDate.replace(/-/g, ".")}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setIsPdfGenerating(false)
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

  // Separate useEffect for localStorage operations
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return

    // Try to load saved data from localStorage
    const savedData = localStorage.getItem("adrChecklistData")
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)

        // Restore form data
        if (parsedData.driverName) setDriverName(parsedData.driverName)
        if (parsedData.truckPlate) setTruckPlate(parsedData.truckPlate)
        if (parsedData.trailerPlate) setTrailerPlate(parsedData.trailerPlate)
        if (parsedData.drivingLicenseDate) setDrivingLicenseDate(parsedData.drivingLicenseDate)
        if (parsedData.adrCertificateDate) setAdrCertificateDate(parsedData.adrCertificateDate)
        if (parsedData.truckDocDate) setTruckDocDate(parsedData.truckDocDate)
        if (parsedData.trailerDocDate) setTrailerDocDate(parsedData.trailerDocDate)
        if (parsedData.checkedItems) setCheckedItems(parsedData.checkedItems)
        if (parsedData.beforeLoadingChecked) setBeforeLoadingChecked(parsedData.beforeLoadingChecked)
        if (parsedData.afterLoadingChecked) setAfterLoadingChecked(parsedData.afterLoadingChecked)
        if (parsedData.expiryDates) setExpiryDates(parsedData.expiryDates)
        if (parsedData.selectedInspector) setSelectedInspector(parsedData.selectedInspector)

        // Validate dates after loading
        if (parsedData.drivingLicenseDate?.month && parsedData.drivingLicenseDate?.year) {
          setTimeout(() => validateLicenseDate("drivingLicense"), 0)
        }
        if (parsedData.adrCertificateDate?.month && parsedData.adrCertificateDate?.year) {
          setTimeout(() => validateLicenseDate("adrCertificate"), 0)
        }
        if (parsedData.truckDocDate?.month && parsedData.truckDocDate?.year) {
          setTimeout(() => validateTruckDocDate(), 0)
        }
        if (parsedData.trailerDocDate?.month && parsedData.trailerDocDate?.year) {
          setTimeout(() => validateTrailerDocDate(), 0)
        }

        // Validate equipment expiry dates
        if (parsedData.expiryDates) {
          Object.keys(parsedData.expiryDates).forEach((itemName) => {
            setTimeout(() => checkIfDateIsExpired(itemName), 0)
          })
        }
      } catch (error) {
        console.error("Error loading saved data:", error)
      }
    }
  }, [isMounted])

  // Add an effect to save data to localStorage whenever relevant state changes
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return

    const dataToSave = {
      driverName,
      truckPlate,
      trailerPlate,
      drivingLicenseDate,
      adrCertificateDate,
      truckDocDate,
      trailerDocDate,
      checkedItems,
      beforeLoadingChecked,
      afterLoadingChecked,
      expiryDates,
      selectedInspector,
    }

    localStorage.setItem("adrChecklistData", JSON.stringify(dataToSave))
  }, [
    isMounted,
    driverName,
    truckPlate,
    trailerPlate,
    drivingLicenseDate,
    adrCertificateDate,
    truckDocDate,
    trailerDocDate,
    checkedItems,
    beforeLoadingChecked,
    afterLoadingChecked,
    expiryDates,
    selectedInspector,
  ])

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

  const validateLicenseDate = (type: "drivingLicense" | "adrCertificate") => {
    const date = type === "drivingLicense" ? drivingLicenseDate : adrCertificateDate
    if (date.month.length === 2 && date.year.length === 4) {
      const month = Number.parseInt(date.month, 10)
      const year = Number.parseInt(date.year, 10)
      const isExpired = year < inspectionYear || (year === inspectionYear && month < inspectionMonth)

      if (type === "drivingLicense") {
        setDrivingLicenseExpired(isExpired)
        setDateValid((prev) => ({ ...prev, drivingLicense: !isExpired }))
      } else {
        setAdrCertificateExpired(isExpired)
        setDateValid((prev) => ({ ...prev, adrCertificate: !isExpired }))
      }
    }
  }

  const validateTruckDocDate = () => {
    if (truckDocDate.month.length === 2 && truckDocDate.year.length === 4) {
      const month = Number.parseInt(truckDocDate.month, 10)
      const year = Number.parseInt(truckDocDate.year, 10)
      const isExpired = year < inspectionYear || (year === inspectionYear && month < inspectionMonth)
      setTruckDocExpired(isExpired)
      setDateValid((prev) => ({ ...prev, truckDoc: !isExpired }))
    }
  }

  const validateTrailerDocDate = () => {
    if (trailerDocDate.month.length === 2 && trailerDocDate.year.length === 4) {
      const month = Number.parseInt(trailerDocDate.month, 10)
      const year = Number.parseInt(trailerDocDate.year, 10)
      const isExpired = year < inspectionYear || (year === inspectionYear && month < inspectionMonth)
      setTrailerDocExpired(isExpired)
      setDateValid((prev) => ({ ...prev, trailerDoc: !isExpired }))
    }
  }

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
        pdf.setLineWidth(0.5)
        pdf.line(margin, y + 20, margin + 70, y + 20)
        addSafeText("Driver Signature (Not Signed)", margin, y + 25)
      }

      const inspectorX = pageWidth - margin - 70
      if (inspectorSignatureData) {
        pdf.addImage(inspectorSignatureData, "PNG", inspectorX, y, 70, 20)
      } else {
        pdf.setLineWidth(0.5)
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
}
