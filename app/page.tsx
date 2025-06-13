"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

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

      // Save the PDF for download only (no email or Google Drive)
      pdf.save(`ADR-Check_${driverName.replace(/\s+/g, "_")}_${checkDate.replace(/-/g, ".")}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setIsPdfGenerating(false)
    }
  }

  const closeFtpModal = () => {
    setShowFtpModal(false)
    setOrderNumber("")
    setUploadStatus(null)
  }

  const handleFtpUpload = async () => {
    setIsUploading(true)
    setUploadStatus("Uploading PDF...")

    try {
      const response = await fetch("/api/upload-ftp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          driverName,
          truckPlate,
          trailerPlate,
          inspectionDate: checkDate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to upload PDF")
      }

      setUploadStatus(data.message || "PDF uploaded successfully!")
    } catch (error: any) {
      console.error("FTP Upload Error:", error)
      setUploadStatus(`Error uploading PDF: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendEmail = async () => {
    setIsSendingEmail(true)
    setEmailStatus("Sending email...")

    try {
      // Generate the PDF data
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let y = 20

      // Function to add safe text
      const addSafeText = (text: string, x: number, y: number, options = {}, color = "#000000") => {
        pdf.setTextColor(color)
        pdf.setFont("helvetica", "bold")
        pdf.text(text, x, y, options)
        pdf.setTextColor("#000000")
      }

      // Function to add a line of text
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

      // Add content to the PDF
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

      // Convert the PDF to base64
      const pdfBase64 = pdf.output("datauristring")

      // Send the email
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspector: selectedInspector,
          driverName: driverName,
          truckPlate: truckPlate,
          trailerPlate: trailerPlate,
          inspectionDate: checkDate,
          pdfData: pdfBase64,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to send email")
      }

      setEmailStatus(data.message || "Email sent successfully!")
    } catch (error: any) {
      console.error("Email Sending Error:", error)
      setEmailStatus(`Error sending email: ${error.message}`)
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <div className="container mx-auto py-4 max-w-4xl relative z-30 bg-white bg-opacity-90 rounded-lg shadow-lg my-8">
      <div className="text-center mb-6">
        <h1 id="adr-title" className="text-2xl font-bold">
          ADR Checklist
        </h1>
      </div>

      <div className="mb-6">
        {/* Centered Inspection Date */}
        <div className="flex flex-col items-center mb-6">
          <Label htmlFor="checkDate" className="text-lg font-semibold mb-2">
            Inspection Date:
          </Label>
          <Input
            id="checkDate"
            value={checkDate}
            onChange={(e) => setCheckDate(e.target.value)}
            className="w-40 text-center"
            placeholder="dd-mm-yyyy"
            inputMode="numeric"
            pattern="[0-9-]*"
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="driverName">Driver's Name:</Label>
          <Input
            id="driverName"
            value={driverName}
            onChange={(e) => {
              const value = e.target.value
              const formatted = capitalizeWords(value)
              setDriverName(formatted)
            }}
            className="w-full"
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="truckPlate">Truck License Plate:</Label>
          <Input
            id="truckPlate"
            value={truckPlate}
            onChange={(e) => setTruckPlate(e.target.value.toUpperCase())}
            className="w-full uppercase"
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="trailerPlate">Trailer License Plate:</Label>
          <Input
            id="trailerPlate"
            value={trailerPlate}
            onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
            className="w-full uppercase"
          />
        </div>

        {/* Document Boxes Section */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Driver and Vehicle Documents:</h2>

          {/* Driving License Document Box */}
          <div className="mb-6 border-b pb-4 relative bg-white overflow-hidden rounded-lg shadow-sm">
            <Image
              src="/images/driving-license.jpg"
              alt="Driving License"
              fill
              className="absolute top-0 left-0 w-full h-full object-contain opacity-45 mix-blend-multiply dark:mix-blend-screen z-0 pointer-events-none"
            />
            <div className="relative z-10 pl-2 pt-2 pb-2 flex flex-col justify-center min-h-[120px]">
              <div className="flex items-center justify-between mb-2 min-h-[120px]">
                <div className="flex-1">
                  <div className="flex items-center">
                    <Label className="font-medium">Driving License</Label>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>de - Führerschein</div>
                    <div>nl - Rijbewijs</div>
                    <div>pl - Prawo jazdy</div>
                    <div>ru - Водительское удостоверение</div>
                    <div>ro - Permis de conducere</div>
                    <div>rs - Возачка дозвола</div>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-sm">Expiry (MM/YYYY):</Label>
                <div className="flex items-center">
                  <Input
                    value={drivingLicenseDate.month}
                    onChange={(e) => handleLicenseDateChange("drivingLicense", "month", e.target.value)}
                    placeholder="MM"
                    maxLength={2}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-16 h-10 mr-1 ${
                      drivingLicenseExpired
                        ? "border-red-500 border-2"
                        : dateValid.drivingLicense
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  <span>/</span>
                  <Input
                    ref={drivingLicenseYearRef}
                    value={drivingLicenseDate.year}
                    onChange={(e) => handleLicenseDateChange("drivingLicense", "year", e.target.value)}
                    placeholder="YYYY"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-20 h-10 ml-1 ${
                      drivingLicenseExpired
                        ? "border-red-500 border-2"
                        : dateValid.drivingLicense
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  {drivingLicenseExpired && <span className="ml-2 text-red-500">Expired</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ADR Certificate Document Box */}
          <div className="mb-6 border-b pb-4 relative bg-white overflow-hidden rounded-lg shadow-sm">
            <Image
              src="/images/adr-certificate.jpg"
              alt="ADR Certificate"
              fill
              className="absolute top-0 left-0 w-full h-full object-contain opacity-45 mix-blend-multiply dark:mix-blend-screen z-0 pointer-events-none"
            />
            <div className="relative z-10 pl-2 pt-2 pb-2 flex flex-col justify-center min-h-[120px]">
              <div className="flex items-center justify-between mb-2 min-h-[120px]">
                <div className="flex-1">
                  <div className="flex items-center">
                    <Label className="font-medium">ADR Certificate</Label>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>de - ADR-Bescheinigung</div>
                    <div>nl - ADR-certificaat</div>
                    <div>pl - Świadectwo ADR</div>
                    <div>ru - Свидетельство ADR</div>
                    <div>ro - Certificat ADR</div>
                    <div>rs - АДР сертификат</div>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-sm">Expiry (MM/YYYY):</Label>
                <div className="flex items-center">
                  <Input
                    value={adrCertificateDate.month}
                    onChange={(e) => handleLicenseDateChange("adrCertificate", "month", e.target.value)}
                    placeholder="MM"
                    maxLength={2}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-16 h-10 mr-1 ${
                      adrCertificateExpired
                        ? "border-red-500 border-2"
                        : dateValid.adrCertificate
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  <span>/</span>
                  <Input
                    ref={adrCertificateYearRef}
                    value={adrCertificateDate.year}
                    onChange={(e) => handleLicenseDateChange("adrCertificate", "year", e.target.value)}
                    placeholder="YYYY"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-20 h-10 ml-1 ${
                      adrCertificateExpired
                        ? "border-red-500 border-2"
                        : dateValid.adrCertificate
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  {adrCertificateExpired && <span className="ml-2 text-red-500">Expired</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Combined Vehicle Documents Box */}
          <div className="mb-6 border-b pb-4 relative bg-white overflow-hidden rounded-lg shadow-sm">
            <Image
              src="/images/truck-document.jpg"
              alt="Vehicle Documents"
              fill
              className="absolute top-0 left-0 w-full h-full object-contain opacity-45 mix-blend-multiply dark:mix-blend-screen z-0 pointer-events-none"
            />
            <div className="relative z-10 pl-2 pt-2 pb-2 flex flex-col justify-center min-h-[160px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center">
                    <Label className="font-medium">Vehicle Documents</Label>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>de - Fahrzeugschein</div>
                    <div>nl - Kentekenbewijs</div>
                    <div>pl - Dowód rejestracyjny</div>
                    <div>ru - Свидетельство о регистрации</div>
                    <div>ro - Certificat de înmatriculare</div>
                    <div>rs - Саобраћајна дозвола</div>
                  </div>
                </div>
              </div>

              {/* Truck Document Expiry */}
              <div className="mt-2">
                <Label className="text-sm font-medium">Truck Document Expiry (MM/YYYY):</Label>
                <div className="flex items-center">
                  <Input
                    value={truckDocDate.month}
                    onChange={(e) => handleTruckDocDateChange("month", e.target.value)}
                    placeholder="MM"
                    maxLength={2}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-16 h-10 mr-1 ${
                      truckDocExpired
                        ? "border-red-500 border-2"
                        : dateValid.truckDoc
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  <span>/</span>
                  <Input
                    ref={truckDocYearRef}
                    value={truckDocDate.year}
                    onChange={(e) => handleTruckDocDateChange("year", e.target.value)}
                    placeholder="YYYY"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-20 h-10 ml-1 ${
                      truckDocExpired
                        ? "border-red-500 border-2"
                        : dateValid.truckDoc
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  {truckDocExpired && <span className="ml-2 text-red-500">Expired</span>}
                </div>
              </div>

              {/* Trailer Document Expiry */}
              <div className="mt-3">
                <Label className="text-sm font-medium">Trailer Document Expiry (MM/YYYY):</Label>
                <div className="flex items-center">
                  <Input
                    value={trailerDocDate.month}
                    onChange={(e) => handleTrailerDocDateChange("month", e.target.value)}
                    placeholder="MM"
                    maxLength={2}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-16 h-10 mr-1 ${
                      trailerDocExpired
                        ? "border-red-500 border-2"
                        : dateValid.trailerDoc
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  <span>/</span>
                  <Input
                    ref={trailerDocYearRef}
                    value={trailerDocDate.year}
                    onChange={(e) => handleTrailerDocDateChange("year", e.target.value)}
                    placeholder="YYYY"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-20 h-10 ml-1 ${
                      trailerDocExpired
                        ? "border-red-500 border-2"
                        : dateValid.trailerDoc
                          ? "border-green-500 border-2"
                          : ""
                    }`}
                  />
                  {trailerDocExpired && <span className="ml-2 text-red-500">Expired</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inspection Date */}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Select the equipment the driver has:</h2>
        {equipmentItems.map((item, index) => (
          <div key={index} className="mb-6 border-b pb-4 relative bg-white overflow-hidden rounded-lg shadow-sm">
            {/* Faded background image */}
            {item.image && (
              <Image
                src={item.image || "/placeholder.svg"}
                alt={item.name}
                fill
                className={`absolute top-0 left-0 w-full h-full object-contain opacity-45 mix-blend-multiply dark:mix-blend-screen z-0 pointer-events-none ${
                  item.name === "Safety glasses" || item.name === "Flashlight" || item.name === "Drain seal"
                    ? "scale-50"
                    : ""
                }`}
              />
            )}

            <div className="relative z-10 pl-2 pt-2 pb-2 flex flex-col justify-center min-h-[120px]">
              <div className="flex items-center justify-between mb-2 min-h-[120px]">
                <div className="flex-1">
                  <div className="flex items-center">
                    <Label htmlFor={`equipment-${index}`} className="font-medium">
                      {item.name}
                    </Label>
                  </div>
                  {/* Add red text for items from Flashlight to Collection bucket */}
                  {(item.name === "Flashlight" ||
                    item.name === "Rubber gloves" ||
                    item.name === "Safety glasses" ||
                    item.name === "Mask + filter (Date for ADR class 6.1/2.3)" ||
                    item.name === "Collection bucket") && (
                    <div className="text-sm font-medium mt-1" style={{ color: "#FF0000" }}>
                      One piece for each driver!
                    </div>
                  )}
                  <div className="text-sm text-gray-600 mt-1">
                    {item.translations.map((translation, i) => (
                      <div key={i}>{translation}</div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center mx-4 gap-2 h-full">
                  {item.additionalImage && (
                    <div className="equipment-image-container ml-2">
                      <Image
                        src={item.additionalImage || "/placeholder.svg"}
                        alt={`${item.name} additional`}
                        width={50}
                        height={50}
                        style={{
                          width: "auto",
                          height: "auto",
                          maxWidth: "100%",
                          maxHeight: "100%",
                        }}
                      />
                    </div>
                  )}
                  <Checkbox
                    id={`equipment-${index}`}
                    checked={checkedItems[item.name] || false}
                    onCheckedChange={(checked) => handleEquipmentCheck(item.name, checked === true)}
                    className="h-10 w-10 mr-2 border-2 border-gray-400 text-[16px] data-[state=checked]:bg-[#006400] data-[state=checked]:text-white rounded-md"
                  />
                </div>
              </div>

              {item.hasDate && (
                <div className="mt-2">
                  <Label className="text-sm">Expiry (MM/YYYY):</Label>
                  <div className="flex items-center">
                    <Input
                      ref={dateInputRefs.current[item.name]?.month}
                      value={expiryDates[item.name]?.month || ""}
                      onChange={(e) => handleExpiryDateChange(item.name, "month", e.target.value)}
                      placeholder="MM"
                      className="w-16 h-10 mr-1"
                      maxLength={2}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    <span>/</span>
                    <Input
                      ref={dateInputRefs.current[item.name]?.year}
                      value={expiryDates[item.name]?.year || ""}
                      onChange={(e) => handleExpiryDateChange(item.name, "year", e.target.value)}
                      placeholder="YYYY"
                      className="w-20 h-10 ml-1"
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    {expiredItems[item.name] && <span className="ml-2 text-red-500">Expired</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Before Loading:</h2>
        <div className="space-y-2">
          {beforeLoadingItems.map((item, index) => (
            <div key={index} className="flex items-center">
              <Checkbox
                id={`before-loading-${index}`}
                checked={beforeLoadingChecked[item] || false}
                onCheckedChange={(checked) => handleBeforeLoadingCheck(item, checked === true)}
                className="h-6 w-6 mr-2 border-2 border-gray-400 text-[16px] data-[state=checked]:bg-[#006400] data-[state=checked]:text-white rounded-md"
              />
              <Label htmlFor={`before-loading-${index}`}>{item}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">After Loading:</h2>
        <div className="space-y-2">
          {afterLoadingItems.map((item, index) => (
            <div key={index} className="flex items-center">
              <Checkbox
                id={`after-loading-${index}`}
                checked={afterLoadingChecked[item] || false}
                onCheckedChange={(checked) => handleAfterLoadingCheck(item, checked === true)}
                className="h-6 w-6 mr-2 border-2 border-gray-400 text-[16px] data-[state=checked]:bg-[#006400] data-[state=checked]:text-white rounded-md"
              />
              <Label htmlFor={`after-loading-${index}`}>{item}</Label>
            </div>
          ))}
        </div>
      </div>

      {showResult && (
        <div className="mb-6 p-4 border rounded">
          {allChecked ? (
            <p className="text-green-600 font-medium">All items are checked.</p>
          ) : (
            <div>
              <h3 className="font-bold mb-2">Missing Items:</h3>
              <ul className="list-disc pl-5">
                {missingItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Inspector:</h2>
        <Select value={selectedInspector} onValueChange={setSelectedInspector}>
          <SelectTrigger className="bg-black text-white border-gray-700">
            <SelectValue placeholder="Select inspector" className="text-white" />
          </SelectTrigger>
          <SelectContent className="bg-black text-white border-gray-700">
            {inspectors.map((name) => (
              <SelectItem key={name} value={name} className="hover:bg-gray-700">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Container to hold both signature boxes side by side */}
        <div className="flex gap-6 mt-6">
          <div className="flex-1">
            <Label className="block mb-2">Driver Signature:</Label>
            <div className="border rounded-md p-2">
              <canvas
                ref={canvasRef}
                className="w-full border border-gray-300 rounded"
                style={{ height: "150px", touchAction: "none" }}
              />
              <Button variant="outline" className="mt-2" onClick={clearSignature}>
                Clear Signature
              </Button>
            </div>
          </div>

          <div className="flex-1">
            <Label className="block mb-2">Inspector Signature:</Label>
            <div className="border rounded-md p-2">
              <canvas
                ref={inspectorCanvasRef}
                className="w-full border border-gray-300 rounded"
                style={{ height: "150px", touchAction: "none" }}
              />
              <Button variant="outline" className="mt-2" onClick={clearInspectorSignature}>
                Clear Signature
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-4 mb-6">
        <Button onClick={checkMissingItems} className="w-full">
          Check Missing Items
        </Button>
        <Button
          onClick={() => setShowFtpModal(true)}
          disabled={isPdfGenerating}
          style={{ backgroundColor: "#0099d0" }}
          className="w-full hover:brightness-90"
        >
          Load the PDF to COGLAS
        </Button>
        <Button onClick={generatePDF} disabled={isPdfGenerating} className="w-full">
          {isPdfGenerating ? "Generating PDF..." : "Download PDF"}
        </Button>
        <Button
          onClick={handleSendEmail}
          disabled={isSendingEmail || isPdfGenerating || !selectedInspector}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {isSendingEmail ? "Sending Email..." : "Send PDF via Email"}
        </Button>

        {emailStatus && (
          <div
            className={`mt-2 p-2 rounded ${
              emailStatus.includes("Failed") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}
          >
            {emailStatus}
          </div>
        )}
      </div>

      {/* FTP Upload Modal */}
      {showFtpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Upload to Coglas</h2>

            <div className="mb-4">
              <Label htmlFor="orderNumber">Order Number:</Label>
              <Input
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Enter order number"
                className="w-full mt-1"
                disabled={isUploading}
              />
            </div>

            {uploadStatus && (
              <div
                className={`mb-4 p-3 rounded ${
                  uploadStatus.includes("Error")
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : uploadStatus.includes("successfully")
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-yellow-100 text-yellow-700 border border-yellow-300"
                }`}
              >
                {uploadStatus}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={closeFtpModal} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleFtpUpload}
                disabled={isUploading || !orderNumber.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? "Uploading..." : "Upload PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
