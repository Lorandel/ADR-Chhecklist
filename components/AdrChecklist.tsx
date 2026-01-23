"use client"

import type { RefObject } from "react"
import { useState, useEffect, useRef, useCallback, createRef, useMemo } from "react"
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

export type ChecklistVariant = "full" | "under1000"

type ADRChecklistProps = {
  variant: ChecklistVariant
  onBack?: () => void
}

export default function ADRChecklist({ variant, onBack }: ADRChecklistProps) {
  const includeAdrCertificate = variant === "full"
  const storageKey = `adrChecklistData_${variant}`

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

  const [remarks, setRemarks] = useState("")

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
        month: RefObject<HTMLInputElement>
        year: RefObject<HTMLInputElement>
      }
    >
  >({})
  const drivingLicenseYearRef = useRef<HTMLInputElement>(null)
  const adrCertificateYearRef = useRef<HTMLInputElement>(null)
  const truckDocYearRef = useRef<HTMLInputElement>(null)
  const trailerDocYearRef = useRef<HTMLInputElement>(null)

  // Equipment items with translations and images
  const equipmentItemsBase = [
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

  const beforeLoadingItemsBase = [
    "ADR plate front+back",
    "Tension belts 2500DAN, 15 for FTL (Tilt trailer)",
    "No visual damages on the truck/trailer",
    "Loading security stanchions (box trailer)",
    "Tires with at least 3 mm of profile",
    "Slip mats, 40 for FTL",
    "Loading floor dry, clean, tidy, odorless",
    "Product compatibility and segregation",
  ]

  const afterLoadingItemsBase = [
    "Goods correctly secured: This load has been secured in accordance STVO 22",
    "Doors closed/Twist locks tight",
    "Seal on right door",
    "ADR plate front + back are open",
    "Markings and Labels in Case of IMO",
  ]


  const equipmentItems = useMemo(() => {
    if (variant !== "under1000") return equipmentItemsBase
    const removed = new Set([
      "ADR Certificate", // not an equipment item, kept for clarity
      "Drain seal",
      "Rubber gloves",
      "Collection bucket",
      "Mask + filter (ADR class 6.1/2.3)",
      "Safety glasses",
      "Shovel",
      "Eye wash",
    ])
    return equipmentItemsBase.filter((item) => !removed.has(item.name))
  }, [variant])

  const beforeLoadingItems = useMemo(() => {
    if (variant !== "under1000") return beforeLoadingItemsBase
    const removed = new Set(["ADR plate front+back"])
    return beforeLoadingItemsBase.filter((item) => !removed.has(item))
  }, [variant])

  const afterLoadingItems = useMemo(() => {
    if (variant !== "under1000") return afterLoadingItemsBase
    const removed = new Set(["ADR plate front + back are open"])
    return afterLoadingItemsBase.filter((item) => !removed.has(item))
  }, [variant])

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
    ctx.strokeStyle = "#0047AB" // Change from "#000" to "#0047AB" (Cobalt Blue)
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
    ctx.strokeStyle = "#0047AB" // Change from "#000" to "#0047AB" (Cobalt Blue)
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

  // Generate PDF report (styled, single page, shared for Download + Email)
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    let binary = ""
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  }

  const buildPdfDocument = async () => {
    if (!isMounted || typeof window === "undefined") throw new Error("Not mounted")

    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const margin = 10
    const contentWidth = pageWidth - margin * 2
    const sigBoxH = 28
    const sigTop = pageHeight - margin - sigBoxH

    const remarksBoxH = 20
    const remarksGap = 2
    const remarksTop = sigTop - remarksGap - remarksBoxH
    const bottomLimit = remarksTop

    const safe = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "-")

    const inspectorColors: Record<string, string> = {
      "Alexandru Dogariu": "#FF8C00",
      "Robert Kerekes": "#8B4513",
      "Eduard Tudose": "#000000",
      "Angela Ilis": "#FF69B4",
      "Lucian Sistac": "#1E90FF",
      "Martian Gherasim": "#008000",
      "Alexandru Florea": "#DAA520",
    }

    const loadCache = new Map<string, string>()
    const loadImageAsDataUrl = async (url: string) => {
      if (loadCache.has(url)) return loadCache.get(url) as string
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch image: ${url}`)
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      loadCache.set(url, dataUrl)
      return dataUrl
    }

    // ---- watermark (center, uses file transparency; no "extra" fading) ----
    let watermarkData: string | null = null
    try {
      watermarkData = await loadImageAsDataUrl("/images/albias-watermark.png")
    } catch {
      watermarkData = null
    }

    // ---- helpers (professional status boxes) ---- (professional status boxes) ----
    const drawStatus = (x: number, y: number, status: "ok" | "bad" | "na") => {
      const size = 5.2
      pdf.setLineWidth(0.35)

      if (status === "ok") {
        pdf.setFillColor(22, 163, 74) // green
        pdf.setDrawColor(22, 163, 74)
        pdf.roundedRect(x, y, size, size, 1.1, 1.1, "F")
        // check mark
        pdf.setDrawColor(255, 255, 255)
        pdf.setLineWidth(0.9)
        pdf.line(x + 1.1, y + 2.9, x + 2.1, y + 3.9)
        pdf.line(x + 2.1, y + 3.9, x + 4.3, y + 1.3)
      } else if (status === "bad") {
        pdf.setFillColor(220, 38, 38) // red
        pdf.setDrawColor(220, 38, 38)
        pdf.roundedRect(x, y, size, size, 1.1, 1.1, "F")
        // X
        pdf.setDrawColor(255, 255, 255)
        pdf.setLineWidth(0.9)
        pdf.line(x + 1.2, y + 1.2, x + 4.0, y + 4.0)
        pdf.line(x + 4.0, y + 1.2, x + 1.2, y + 4.0)
      } else {
        pdf.setDrawColor(156, 163, 175)
        pdf.setFillColor(255, 255, 255)
        pdf.roundedRect(x, y, size, size, 1.1, 1.1, "S")
      }

      // reset
      pdf.setDrawColor(17, 24, 39)
      pdf.setLineWidth(0.2)
    }

    const sectionHeader = (title: string, y: number) => {
      pdf.setFillColor(248, 250, 252)
      pdf.setDrawColor(226, 232, 240)
      pdf.setLineWidth(0.35)
      pdf.roundedRect(margin, y, contentWidth, 7, 2, 2, "FD")
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.setTextColor(15, 23, 42)
      pdf.text(title, margin + 3, y + 5)
      return y + 9
    }

    const kv = (label: string, value: string, x: number, y: number, valueColor = "#0F172A") => {
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.7)
      pdf.setTextColor(51, 65, 85)
      pdf.text(label, x, y)
      const lw = pdf.getTextWidth(label) + 1
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(valueColor)
      pdf.text(value, x + lw, y)
      pdf.setTextColor(15, 23, 42)
    }

    const expiryColor = (expired: boolean) => (expired ? "#DC2626" : "#16A34A")


    const drawFittedParagraph = (
      text: string,
      x: number,
      y: number,
      w: number,
      h: number,
      opts?: { maxFont?: number; minFont?: number; step?: number; lineHeightFactor?: number },
    ) => {
      const clean = (text || "").trim() || "-"
      const maxFont = opts?.maxFont ?? 9
      const minFont = opts?.minFont ?? 1.5
      const step = opts?.step ?? 0.25
      const lineHeightFactor = opts?.lineHeightFactor ?? 1.05

      let chosen = minFont
      let chosenLines: string[] = []

      for (let fs = maxFont; fs >= minFont; fs = Math.round((fs - step) * 100) / 100) {
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(fs)
        const lines = pdf.splitTextToSize(clean, w) as string[]
        const lineH = fs * 0.3527777778 * lineHeightFactor
        const needed = lines.length * lineH
        if (needed <= h) {
          chosen = fs
          chosenLines = lines
          break
        }
      }

      if (chosenLines.length === 0) {
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(minFont)
        chosenLines = pdf.splitTextToSize(clean, w) as string[]
      }

      const lineH = chosen * 0.3527777778 * lineHeightFactor
      let cy = y
      for (const line of chosenLines) {
        pdf.text(line, x, cy)
        cy += lineH
      }
    }


    // ---- header ----
    let y = margin

    // top bar
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.35)
    pdf.roundedRect(margin, y, contentWidth, 18, 3, 3, "FD")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(16)
    pdf.setTextColor(15, 23, 42)
    pdf.text("ADR Checklist", pageWidth / 2, y + 7, { align: "center" })

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.setTextColor(51, 65, 85)
    pdf.text(variant === "under1000" ? "Reduced (Under 1000 pts)" : "Full (1000+ pts)", pageWidth / 2, y + 14, {
      align: "center",
    })

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(71, 85, 105)
    pdf.text(`Inspection: ${safe(checkDate)}`, pageWidth - margin - 3, y + 7, { align: "right" })

    y += 22

    // ---- details ----
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(226, 232, 240)
    pdf.roundedRect(margin, y, contentWidth, 26, 3, 3, "FD")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(15, 23, 42)
    pdf.text("Load details", margin + 3, y + 6)

    const leftX = margin + 3
    const rightX = margin + contentWidth / 2 + 2

    kv("Driver:", safe(driverName), leftX, y + 12)
    kv("Truck:", safe(truckPlate), leftX, y + 17)
    kv("Trailer:", safe(trailerPlate), leftX, y + 22)

    kv(
      "Driving licence:",
      drivingLicenseDate.month && drivingLicenseDate.year
        ? `${drivingLicenseDate.month}/${drivingLicenseDate.year}${drivingLicenseExpired ? " (EXPIRED)" : ""}`
        : "-",
      rightX,
      y + 12,
      drivingLicenseDate.month && drivingLicenseDate.year ? expiryColor(drivingLicenseExpired) : "#0F172A",
    )

    kv(
      "Truck doc:",
      truckDocDate.month && truckDocDate.year ? `${truckDocDate.month}/${truckDocDate.year}${truckDocExpired ? " (EXPIRED)" : ""}` : "-",
      rightX,
      y + 17,
      truckDocDate.month && truckDocDate.year ? expiryColor(truckDocExpired) : "#0F172A",
    )

    kv(
      "Trailer doc:",
      trailerDocDate.month && trailerDocDate.year
        ? `${trailerDocDate.month}/${trailerDocDate.year}${trailerDocExpired ? " (EXPIRED)" : ""}`
        : "-",
      rightX,
      y + 22,
      trailerDocDate.month && trailerDocDate.year ? expiryColor(trailerDocExpired) : "#0F172A",
    )

    y += 32

    // ---- Equipment (two columns, with images) ----
    y = sectionHeader("Equipment", y)

    const colGap = 6
    const colW = (contentWidth - colGap) / 2
    const col1X = margin
    const col2X = margin + colW + colGap

    const rowH = 9.2
    const icon = 7.2
    const pad = 2
    const statusSize = 5.2

    // Preload equipment images (best-effort)
    const uniquePaths = Array.from(
      new Set(
        equipmentItems
          .map((it: any) => (it?.additionalImage ? it.additionalImage : it?.image))
          .filter(Boolean) as string[],
      ),
    )

    const imageMap = new Map<string, string>()
    await Promise.all(
      uniquePaths.map(async (p) => {
        try {
          const data = await loadImageAsDataUrl(p)
          imageMap.set(p, data)
        } catch {
          // ignore
        }
      }),
    )

    const getEquipmentStatus = (itemName: string, hasDate?: boolean) => {
      if (hasDate) {
        const m = expiryDates[itemName]?.month || ""
        const yr = expiryDates[itemName]?.year || ""
        const complete = m.length === 2 && yr.length === 4
        if (!complete) return "na" as const
        return expiredItems[itemName] ? ("bad" as const) : checkedItems[itemName] ? ("ok" as const) : ("bad" as const)
      }
      return checkedItems[itemName] ? ("ok" as const) : ("bad" as const)
    }

    const renderEquipmentRow = (item: any, x: number, yy: number) => {
      if (!item) return
      // row container
      pdf.setDrawColor(226, 232, 240)
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x, yy, colW, rowH, 2, 2, "FD")

      // icon frame
      const ix = x + pad
      const iy = yy + (rowH - icon) / 2
      pdf.setDrawColor(203, 213, 225)
      pdf.setFillColor(248, 250, 252)
      pdf.roundedRect(ix, iy, icon, icon, 1.6, 1.6, "FD")

      const imgPath = item.additionalImage ? item.additionalImage : item.image
      const imgData = imgPath ? imageMap.get(imgPath) : null
      if (imgData) {
        try {
          pdf.addImage(imgData, "PNG", ix + 0.6, iy + 0.6, icon - 1.2, icon - 1.2)
        } catch {
          // ignore
        }
      }

      // label + expiry
      const textX = ix + icon + 2.2
      const maxTextW = colW - (textX - x) - statusSize - 3
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.2)
      pdf.setTextColor(15, 23, 42)

      const name = item.name || ""
      const note =
        name === "Flashlight" ||
        name === "Rubber gloves" ||
        name === "Safety glasses" ||
        name === "Mask + filter (ADR class 6.1/2.3)" ||
        name === "Collection bucket"
          ? " (1/driver)"
          : ""

      const line1 = pdf.splitTextToSize(name + note, maxTextW)
      pdf.text((line1[0] as string) || "", textX, yy + 4.0)

      // expiry (small, right under)
      if (item.hasDate) {
        const m = expiryDates[name]?.month || ""
        const yr = expiryDates[name]?.year || ""
        if (m && yr) {
          const expStr = `${m}/${yr}${expiredItems[name] ? " EXP" : ""}`
          pdf.setFont("helvetica", "bold")
          pdf.setFontSize(7.2)
          pdf.setTextColor(expiryColor(!!expiredItems[name]))
          pdf.text(expStr, textX, yy + 7.3)
        } else {
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(7.0)
          pdf.setTextColor(100, 116, 139)
          pdf.text("Expiry: -", textX, yy + 7.2)
        }
      }

      // status box (right)
      const status = getEquipmentStatus(name, item.hasDate)
      drawStatus(x + colW - statusSize - 2.2, yy + (rowH - statusSize) / 2, status)
    }

    const leftItems = equipmentItems.slice(0, Math.ceil(equipmentItems.length / 2))
    const rightItems = equipmentItems.slice(Math.ceil(equipmentItems.length / 2))
    const rows = Math.max(leftItems.length, rightItems.length)

    for (let i = 0; i < rows; i++) {
      const yy = y + i * (rowH + 1.8)
      if (yy + rowH + 4 > bottomLimit) break
      renderEquipmentRow(leftItems[i], col1X, yy)
      renderEquipmentRow(rightItems[i], col2X, yy)
    }

    y += rows * (rowH + 1.8) + 2

    // ---- Before Loading / After Loading (compact, two columns) ----
    const renderChecklistSection = (title: string, items: string[], checkedMap: Record<string, boolean>, startY: number) => {
      let cy = sectionHeader(title, startY)
      const row = 5.1
      const col1 = items.slice(0, Math.ceil(items.length / 2))
      const col2 = items.slice(Math.ceil(items.length / 2))

      const max = Math.max(col1.length, col2.length)
      for (let i = 0; i < max; i++) {
        const yy = cy + i * row
        if (yy + row + 3 > bottomLimit) break

        const drawLine = (label: string | undefined, x: number) => {
          if (!label) return
          const status: "ok" | "bad" = checkedMap[label] ? "ok" : "bad"
          drawStatus(x + 2, yy - 3.6, status)
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(8.0)
          pdf.setTextColor(15, 23, 42)
          const wrapped = pdf.splitTextToSize(label, colW - 10)
          pdf.text(wrapped, x + 9, yy)
        }

        drawLine(col1[i], col1X)
        drawLine(col2[i], col2X)
      }
      return cy + max * row + 2
    }

    if (y < bottomLimit - 20) y = renderChecklistSection("Before Loading", beforeLoadingItems, beforeLoadingChecked, y)
    if (y < bottomLimit - 20) y = renderChecklistSection("After Loading", afterLoadingItems, afterLoadingChecked, y)
    // Watermark on top (low opacity) to remain visible even over boxes
    if (watermarkData) {
      try {
        // jsPDF supports GState in v2.x; fall back if unavailable
        const GStateCtor = (pdf as any).GState
        if (GStateCtor) {
          const prev = (pdf as any).getGState?.()
          ;(pdf as any).setGState(new GStateCtor({ opacity: 0.12 }))
          const wmW = 120
          const wmH = 120
          pdf.addImage(watermarkData, "PNG", (pageWidth - wmW) / 2, (pageHeight - wmH) / 2, wmW, wmH)
          if (prev) (pdf as any).setGState(prev)
          else (pdf as any).setGState(new GStateCtor({ opacity: 1 }))
        } else {
          const wmW = 120
          const wmH = 120
          pdf.addImage(watermarkData, "PNG", (pageWidth - wmW) / 2, (pageHeight - wmH) / 2, wmW, wmH)
        }
      } catch {
        // ignore
      }
    }

    // ---- remarks (fixed above signatures) ----
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(226, 232, 240)
    pdf.roundedRect(margin, remarksTop, contentWidth, remarksBoxH, 3, 3, "FD")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9.2)
    pdf.setTextColor(15, 23, 42)
    pdf.text("Remarks", margin + 3, remarksTop + 6)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8.2)
    pdf.setTextColor(15, 23, 42)
    drawFittedParagraph(remarks, margin + 3, remarksTop + 10, contentWidth - 6, remarksBoxH - 12, {
      maxFont: 8.2,
      minFont: 1.5,
      step: 0.25,
      lineHeightFactor: 1.05,
    })




    // ---- signatures (fixed bottom) ----
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(226, 232, 240)
    pdf.roundedRect(margin, sigTop, contentWidth, sigBoxH, 3, 3, "FD")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(15, 23, 42)
    pdf.text("Signatures", margin + 3, sigTop + 6)

    const sigW = 72
    const sigH = 14
    const driverX = margin + 3
    const inspectorX = margin + contentWidth - 3 - sigW

    pdf.setDrawColor(148, 163, 184)
    pdf.setLineWidth(0.35)
    pdf.roundedRect(driverX, sigTop + 10, sigW, sigH, 2, 2, "S")
    pdf.roundedRect(inspectorX, sigTop + 10, sigW, sigH, 2, 2, "S")

    if (signatureData) {
      pdf.addImage(signatureData, "PNG", driverX + 1, sigTop + 10.8, sigW - 2, sigH - 1.6)
    }
    if (inspectorSignatureData) {
      pdf.addImage(inspectorSignatureData, "PNG", inspectorX + 1, sigTop + 10.8, sigW - 2, sigH - 1.6)
    }

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8.6)
    pdf.setTextColor(51, 65, 85)
    pdf.text("Driver", driverX, sigTop + 26)
    pdf.text("Inspector", inspectorX, sigTop + 26)

    const inspectorColor = inspectorColors[selectedInspector] || "#0F172A"
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8.6)
    pdf.setTextColor(inspectorColor)
    pdf.text(safe(selectedInspector), inspectorX, sigTop + 22)

    // Single page by construction: we never add pages
    return pdf
  }

  const generatePDF = async () => {
    if (!isMounted || typeof window === "undefined") return
    setIsPdfGenerating(true)
    try {
      const pdf = await buildPdfDocument()
      const filename = `ADR-Check_${(driverName || "Driver").replace(/\s+/g, "_")}_${(checkDate || "date").replace(
        /-/g,
        ".",
      )}.pdf`
      pdf.save(filename)
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
    setRemarks("")
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

    // Reset signatures (important: these must run with the latest canvas refs)
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
      localStorage.removeItem(storageKey)
    }
  }, [equipmentItems, beforeLoadingItems, afterLoadingItems, clearSignature, clearInspectorSignature, storageKey])

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
    const savedData = localStorage.getItem(storageKey)
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)

        // Restore form data
        if (parsedData.driverName) setDriverName(parsedData.driverName)
        if (parsedData.truckPlate) setTruckPlate(parsedData.truckPlate)
        if (parsedData.trailerPlate) setTrailerPlate(parsedData.trailerPlate)
        if (parsedData.drivingLicenseDate) setDrivingLicenseDate(parsedData.drivingLicenseDate)
        if (includeAdrCertificate && parsedData.adrCertificateDate) setAdrCertificateDate(parsedData.adrCertificateDate)
        if (parsedData.truckDocDate) setTruckDocDate(parsedData.truckDocDate)
        if (parsedData.trailerDocDate) setTrailerDocDate(parsedData.trailerDocDate)
        if (parsedData.checkedItems) setCheckedItems(parsedData.checkedItems)
        if (parsedData.beforeLoadingChecked) setBeforeLoadingChecked(parsedData.beforeLoadingChecked)
        if (parsedData.afterLoadingChecked) setAfterLoadingChecked(parsedData.afterLoadingChecked)
        if (parsedData.expiryDates) setExpiryDates(parsedData.expiryDates)
        if (parsedData.selectedInspector) setSelectedInspector(parsedData.selectedInspector)

        if (typeof parsedData.remarks === "string") setRemarks(parsedData.remarks)

        // Validate dates after loading
        if (parsedData.drivingLicenseDate?.month && parsedData.drivingLicenseDate?.year) {
          setTimeout(() => validateLicenseDate("drivingLicense"), 0)
        }
        if (includeAdrCertificate && parsedData.adrCertificateDate?.month && parsedData.adrCertificateDate?.year) {
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
      ...(includeAdrCertificate ? { adrCertificateDate } : {}),
      truckDocDate,
      trailerDocDate,
      checkedItems,
      beforeLoadingChecked,
      afterLoadingChecked,
      expiryDates,
      selectedInspector,
      remarks,
    }

    localStorage.setItem(storageKey, JSON.stringify(dataToSave))
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
    remarks,
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

  // Find the handleSendEmail function and replace it with this improved version:

  const handleSendEmail = async () => {
    if (!isMounted || typeof window === "undefined") return

    setIsSendingEmail(true)
    setEmailStatus("Preparing email...")

    try {
      // Build the same styled 1-page PDF used by Download
      const pdf = await buildPdfDocument()
      setEmailStatus("PDF generated, sending email...")

      const pdfBuffer = pdf.output("arraybuffer")
      const pdfBase64 = arrayBufferToBase64(pdfBuffer)

      if (!pdfBase64 || pdfBase64.length === 0) {
        throw new Error("Generated PDF is empty")
      }

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectorName: selectedInspector,
          pdfBase64,
          driverName,
          truckPlate,
          trailerPlate,
          inspectionDate: checkDate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Server responded with status ${response.status}`)
      }

      if (data.success) {
        setEmailStatus("Email sent successfully!")
        resetForm()
      } else {
        setEmailStatus(data.message || "Email sent successfully!")
      }
    } catch (err: any) {
      console.error("Email sending error:", err)
      setEmailStatus(`Failed to send email: ${err.message}. Please try again.`)
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <div className="container mx-auto py-4 max-w-4xl relative z-30 bg-white bg-opacity-90 rounded-lg shadow-lg my-8">
      <div className="text-center mb-6">
        <h1 id="adr-title" className="text-2xl font-bold">
          ADR Checklist{variant === "under1000" ? " (Under 1000 pts)" : ""}
        </h1>
      </div>

      {onBack && (
        <div className="flex justify-start mb-4">
          <Button variant="outline" className="bg-transparent" onClick={onBack}>
            ← Back
          </Button>
        </div>
      )}

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

          {includeAdrCertificate && (
            <>
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
            </>
          )}

          

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
                    item.name === "Mask + filter (ADR class 6.1/2.3)" ||
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
                    {(() => {
                      const m = expiryDates[item.name]?.month || ""
                      const y = expiryDates[item.name]?.year || ""
                      const complete = m.length === 2 && y.length === 4
                      const expired = !!expiredItems[item.name]
                      const borderClass = expired
                        ? "border-red-500 border-2"
                        : complete
                          ? "border-green-500 border-2"
                          : ""

                      return (
                        <>
                          <Input
                            ref={dateInputRefs.current[item.name]?.month}
                            value={m}
                            onChange={(e) => handleExpiryDateChange(item.name, "month", e.target.value)}
                            placeholder="MM"
                            className={`w-16 h-10 mr-1 ${borderClass}`}
                            maxLength={2}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                          <span>/</span>
                          <Input
                            ref={dateInputRefs.current[item.name]?.year}
                            value={y}
                            onChange={(e) => handleExpiryDateChange(item.name, "year", e.target.value)}
                            placeholder="YYYY"
                            className={`w-20 h-10 ml-1 ${borderClass}`}
                            maxLength={4}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                          {expired && <span className="ml-2 text-red-500">Expired</span>}
                        </>
                      )
                    })()}
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


      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Remarks:</h2>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="w-full min-h-[120px] border border-gray-300 rounded-md p-2"
          placeholder="Write remarks here..."
        />
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
              <Button variant="outline" className="mt-2 bg-transparent" onClick={clearSignature}>
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
              <Button variant="outline" className="mt-2 bg-transparent" onClick={clearInspectorSignature}>
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
        <Button onClick={generatePDF} disabled={isPdfGenerating} className="w-full">
          {isPdfGenerating ? "Generating PDF..." : "Download PDF"}
        </Button>
        <Button
          onClick={handleSendEmail}
          disabled={isSendingEmail || isPdfGenerating || !selectedInspector}
          style={{ backgroundColor: "#0099d0" }}
          className="w-full hover:brightness-90"
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
    </div>
  )
}
