"use client"

import type { RefObject, ChangeEvent } from "react"
import { useState, useEffect, useRef, useCallback, createRef, useMemo } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/AuthProvider"
import Image from "next/image"
import { compressImageFile } from "@/lib/imageCompress"
import { stableStringify } from "@/lib/stableStringify"
import { idbPutPhoto, idbGetPhoto, idbDeletePhoto } from "@/lib/offlinePhotos"
import { sha256Hex } from "@/lib/hash"

const INSPECTOR_COLORS: Record<string, string> = {
  "Alexandru Dogariu": "#FF8C00",
  "Robert Kerekes": "#A47332",
  "Eduard Tudose": "#474747",
  "Angela Ilis": "#E48BB5",
  "Lucian Sistac": "#55ABE5",
  "Martian Gherasim": "#5FBE7D",
  "Alexandru Florea": "#DAA520",
}

const capitalizeWords = (str: string) =>
  str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")

export type ChecklistVariant = "full" | "under1000"

type PhotoUploadStatus = "queued" | "uploading" | "done" | "error"

type UploadedPhoto = {
  id: string
  name: string
  previewUrl: string
  status: PhotoUploadStatus
  progress: number // 0-100
  url?: string // public blob url when uploaded
  contentType?: string
  error?: string
}

type ADRChecklistProps = {
  variant: ChecklistVariant
  onBack?: () => void
}

export default function ADRChecklist({ variant, onBack }: ADRChecklistProps) {
  const includeAdrCertificate = variant === "full"
  const { inspectorName: loggedInspectorName, inspectorEmail: loggedInspectorEmail, session } = useAuth()
  const userId = (session as any)?.user?.id || (session as any)?.user?.sub || "anonymous"
  const storageKey = `adrChecklistData_${variant}_${userId}`

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

  // Confirmation popup for Send/Download actions
  const [confirmAction, setConfirmAction] = useState<"download" | "send" | null>(null)

  // Inspector is always the logged-in inspector (no manual selector).
  useEffect(() => {
    if (!loggedInspectorName) return
    if (selectedInspector !== loggedInspectorName) {
      setSelectedInspector(loggedInspectorName)
    }
  }, [loggedInspectorName, selectedInspector])
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

  // Remarks + photo uploads
  const [remarks, setRemarks] = useState("")
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const uploadXhrRefs = useRef<Record<string, XMLHttpRequest>>({})

  // Throttle progress updates + prevent UI jitter
  const lastProgRef = useRef<Record<string, { t: number; p: number }>>({})
  const uploadingRunnerRef = useRef(false)
  const lastAttemptRef = useRef<Record<string, number>>({})


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

  const uploadPhoto = useCallback(
    (file: File, photoId: string) => {
      return new Promise<{ url: string; contentType: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        uploadXhrRefs.current[photoId] = xhr

        xhr.open("POST", "/api/upload-photo")
        xhr.responseType = "json"

        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return
          const progress = Math.round((evt.loaded / evt.total) * 100)
          const now = Date.now()
          const last = lastProgRef.current[photoId] || { t: 0, p: -1 }
          // update at most ~8 times/sec OR when progress jumps significantly
          if (progress === last.p) return
          if (now - last.t < 120 && progress - last.p < 2) return
          lastProgRef.current[photoId] = { t: now, p: progress }
          setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, progress, status: "uploading" } : p)))
        }

        xhr.onload = () => {
          const res = xhr.response
          if (xhr.status >= 200 && xhr.status < 300 && res?.success && res?.url) {
            setPhotos((prev) =>
              prev.map((p) =>
                p.id === photoId
                  ? { ...p, progress: 100, status: "done", url: res.url, contentType: res.contentType || file.type }
                  : p,
              ),
            )
            resolve({ url: res.url, contentType: res.contentType || file.type })
            return
          }

          const status = xhr.status || 0
          const message = res?.message || res?.error || `Upload failed (${status})`

          // If the internet drops mid-upload, some browsers keep navigator.onLine=true but XHR fails (status 0).
          // We never hard-fail on network/server hiccups; keep the photo queued and retry automatically.
          if (status === 0 || status >= 500) {
            setPhotos((prev) =>
              prev.map((p) => (p.id === photoId ? { ...p, status: "queued", progress: 0, error: message } : p)),
            )
          } else {
            // For 4xx errors (bad request), surface the error.
            setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: "error", error: message } : p)))
          }

          reject(new Error(message))
        }

        xhr.onerror = () => {
          const message = "Upload paused (network issue). Will retry automatically when online."
          setPhotos((prev) =>
            prev.map((p) => (p.id === photoId ? { ...p, status: "queued", progress: 0, error: message } : p)),
          )
          reject(new Error(message))
        }

        const formData = new FormData()
        formData.append("file", file)
        xhr.send(formData)

        // Mark as uploading immediately
        setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: "uploading", progress: 0 } : p)))
      })
    },
    [setPhotos],
  )

  const handlePhotoInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newPhotos: UploadedPhoto[] = files.map((file) => {
      const rawId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`
      const id = `${userId}_${rawId}`
      return {
        id,
        name: file.name || `photo_${Date.now()}.jpg`,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
        contentType: file.type,
      }
    })

    setPhotos((prev) => [...prev, ...newPhotos])

    // Persist photos offline (so they survive refresh) and upload sequentially (less UI jitter)
    for (let idx = 0; idx < newPhotos.length; idx++) {
      const p = newPhotos[idx]
      const originalFile = files[idx]

      // Reduce image size automatically before upload (faster uploads, smaller ZIP/email).
      let fileToUpload: File = originalFile
      try {
        fileToUpload = await compressImageFile(originalFile, { maxSide: 1600, quality: 0.75, mimeType: "image/jpeg" })
      } catch {
        fileToUpload = originalFile
      }

      // If compression changed name/type, keep metadata in state (used later when zipping/emailing).
      if (fileToUpload !== originalFile) {
        setPhotos((prev) =>
          prev.map((ph) => (ph.id === p.id ? { ...ph, name: fileToUpload.name, contentType: fileToUpload.type } : ph)),
        )
      }

      // Save blob in IndexedDB (offline support)
      try {
        await idbPutPhoto({
          id: p.id,
          blob: fileToUpload,
          name: fileToUpload.name,
          contentType: fileToUpload.type,
          createdAt: Date.now(),
        })
      } catch {
        // IndexedDB can be unavailable in some private modes; ignore
      }

      // If offline, keep queued; upload will resume automatically when online
      if (typeof navigator !== "undefined" && !navigator.onLine) continue

      try {
        await uploadPhoto(fileToUpload, p.id)
      } catch {
        // State already updated in uploadPhoto
      }
    }

    // Allow selecting the same file again
    e.target.value = ""
  }

  // Retry queued photos automatically when the connection comes back.
  const tryUploadPendingPhotos = useCallback(async () => {
    if (uploadingRunnerRef.current) return
    if (typeof navigator !== "undefined" && !navigator.onLine) return

    const pending = photos.filter((p) => p.status === "queued")
    if (pending.length === 0) return

    uploadingRunnerRef.current = true
    try {
      for (const p of pending) {
        const last = lastAttemptRef.current[p.id] || 0
        if (Date.now() - last < 8000) continue // avoid rapid retry jitter
        lastAttemptRef.current[p.id] = Date.now()

        const rec = await idbGetPhoto(p.id).catch(() => null)
        if (!rec?.blob) continue

        const file = new File([rec.blob], rec.name || p.name, {
          type: rec.contentType || p.contentType || "image/jpeg",
        })

        try {
          await uploadPhoto(file, p.id)
        } catch {
          // keep queued/error as set by uploadPhoto
        }
      }
    } finally {
      uploadingRunnerRef.current = false
    }
  }, [photos, uploadPhoto])

  useEffect(() => {
    const onOnline = () => {
      void tryUploadPendingPhotos()
    }
    window.addEventListener("online", onOnline)
    // attempt once on mount (if there are queued photos restored)
    void tryUploadPendingPhotos()
    return () => window.removeEventListener("online", onOnline)
  }, [tryUploadPendingPhotos])

  const removePhoto = (photoId: string) => {
    const xhr = uploadXhrRefs.current[photoId]
    if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
      try {
        xhr.abort()
      } catch {
        // ignore
      }
    }

    void idbDeletePhoto(photoId).catch(() => {})

    setPhotos((prev) => {
      const toRemove = prev.find((p) => p.id === photoId)
      if (toRemove?.previewUrl) {
        try {
          URL.revokeObjectURL(toRemove.previewUrl)
        } catch {
          // ignore
        }
      }
      return prev.filter((p) => p.id !== photoId)
    })
  }



  // Build a single-page, stylized ADR PDF (used for both Download ZIP and Send Email)
  const buildAdrPdf = async () => {
    const { jsPDF } = await import("jspdf")

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    const margin = 10
    const gap = 6
    const headerH = 18

    const inspectorColors: Record<string, string> = {
       "Alexandru Dogariu": "#FF8C00",
       "Robert Kerekes": "#A47332",
       "Eduard Tudose": "#474747",
       "Angela Ilis": "#E48BB5",
       "Lucian Sistac": "#55ABE5",
       "Martian Gherasim": "#5FBE7D",
       "Alexandru Florea": "#DAA520",
    }

    const safeVal = (v: string) => {
      const s = (v || "").toString().trim()
      return s.length ? s : "-"
    }

    const formatExpiry = (
      d: { month: string; year: string },
      expired: boolean,
      opts?: { notApplicable?: boolean },
    ): { text: string; color: string } => {
      if (opts?.notApplicable) return { text: "N/A", color: "#6B7280" }
      if (!d?.month || !d?.year) return { text: "-", color: "#111827" }
      return {
        text: `${d.month}/${d.year}${expired ? " (EXPIRED)" : ""}`,
        color: expired ? "#B91C1C" : "#166534",
      }
    }

    const isJpeg = (url: string) => /\.(jpe?g)$/i.test(url)

    const imageCache = new Map<string, string>()
    const loadImageDataUrl = async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load image: ${url} (${res.status})`)
      const blob = await res.blob()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error(`Failed to read image as DataURL: ${url}`))
        reader.readAsDataURL(blob)
      })
    }

    const getImage = async (url: string) => {
      if (imageCache.has(url)) return imageCache.get(url) as string
      const dataUrl = await loadImageDataUrl(url)
      imageCache.set(url, dataUrl)
      return dataUrl
    }

    const truncateToWidth = (str: string, maxWidth: number) => {
      const s = (str || "").toString()
      if (pdf.getTextWidth(s) <= maxWidth) return s
      let out = s
      while (out.length > 0 && pdf.getTextWidth(out + "…") > maxWidth) {
        out = out.slice(0, -1)
      }
      return out.length ? out + "…" : ""
    }

    const drawStatus = (x: number, y: number, ok: boolean) => {
      const w = 5
      const h = 5

      pdf.setLineWidth(0.2)
      pdf.setDrawColor(203, 213, 225) // slate-300

      if (ok) {
        pdf.setFillColor(230, 244, 234) // green-50-ish
      } else {
        pdf.setFillColor(252, 232, 230) // red-50-ish
      }

      // rounded status box
      // @ts-ignore - roundedRect exists at runtime
      pdf.roundedRect(x, y, w, h, 1.2, 1.2, "FD")

      if (ok) {
        pdf.setDrawColor(22, 101, 52)
        pdf.setLineWidth(0.9)
        pdf.line(x + 1.1, y + 2.7, x + 2.2, y + 3.8)
        pdf.line(x + 2.2, y + 3.8, x + 4.0, y + 1.2)
      } else {
        pdf.setDrawColor(185, 28, 28)
        pdf.setLineWidth(0.9)
        pdf.line(x + 1.2, y + 1.2, x + 3.8, y + 3.8)
        pdf.line(x + 3.8, y + 1.2, x + 1.2, y + 3.8)
      }

      pdf.setLineWidth(0.2)
      pdf.setDrawColor(203, 213, 225)
    }

    const drawIconBox = async (x: number, y: number, size: number, imgUrl: string) => {
      const img = await getImage(imgUrl)
      pdf.setLineWidth(0.2)
      pdf.setDrawColor(226, 232, 240)
      pdf.setFillColor(255, 255, 255)
      // @ts-ignore - roundedRect exists at runtime
      pdf.roundedRect(x, y, size, size, 1.2, 1.2, "FD")

      const padding = 0.6
      const imgType = isJpeg(imgUrl) ? "JPEG" : "PNG"
      pdf.addImage(img, imgType, x + padding, y + padding, size - padding * 2, size - padding * 2)
    }

    // Preload all icons + watermark (faster and consistent)
    try {
      const urls = [
        "/images/albias-watermark.png",
        ...Array.from(new Set(equipmentItems.map((i) => i.image).filter(Boolean))),
      ]
      await Promise.all(
        urls.map(async (u) => {
          try {
            await getImage(u)
          } catch {
            // ignore missing icons
          }
        }),
      )
    } catch {
      // ignore
    }

    // Watermark (drawn LAST so it stays visible over boxes)
    const addWatermark = async () => {
      try {
        const watermark = await getImage("/images/albias-watermark.png")
        // @ts-ignore - GState exists at runtime
        const GState = (pdf as any).GState
        if (GState) {
          // @ts-ignore
          const gs = new (pdf as any).GState({ opacity: 0.18 })
          // @ts-ignore
          ;(pdf as any).setGState(gs)
        }

        pdf.addImage(watermark, "PNG", pageW / 2 - 55, pageH / 2 - 55, 110, 110)

        // reset opacity
        // @ts-ignore
        if ((pdf as any).setGState && (pdf as any).GState) {
          // @ts-ignore
          ;(pdf as any).setGState(new (pdf as any).GState({ opacity: 1 }))
        }
      } catch {
        // Continue without watermark
      }
    }
    // Header (red)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(18)
    pdf.setTextColor(0, 0, 0)
    pdf.text("ADR Checklist", pageW / 2, 12, { align: "center" })

    if (variant === "under1000") {
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "normal")
      pdf.text("UNDER 1000 PTS • Reduced checklist", pageW / 2, 16.5, { align: "center" })
    }

    pdf.setTextColor(17, 24, 39)

    // ---- Driver / vehicle info card ----
    const cardX = margin
    const cardY = headerH + gap
    const cardW = pageW - margin * 2
    const cardH = 46

    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.3)
    pdf.setFillColor(248, 250, 252)
    // @ts-ignore
    pdf.roundedRect(cardX, cardY, cardW, cardH, 3, 3, "FD")

    const colGap = 8
    const colW = (cardW - colGap) / 2
    const leftX = cardX + 6
    const rightX = cardX + 6 + colW + colGap

    const rowStartY = cardY + 9
    const rowStep = 7

    const drawField = (x: number, y: number, label: string, value: string, valueColor = "#111827") => {
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(100, 116, 139) // slate-500
      pdf.text(label, x, y)

      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(valueColor)
      const lw = pdf.getTextWidth(label)
      const v = truncateToWidth(value, colW - lw - 2)
      pdf.text(v, x + lw + 1.5, y)

      pdf.setTextColor(17, 24, 39)
    }

    const dl = formatExpiry(drivingLicenseDate, drivingLicenseExpired)
    const adr = includeAdrCertificate
      ? formatExpiry(adrCertificateDate, adrCertificateExpired)
      : formatExpiry({ month: "", year: "" }, false, { notApplicable: true })
    const truckDoc = formatExpiry(truckDocDate, truckDocExpired)
    const trailerDoc = formatExpiry(trailerDocDate, trailerDocExpired)

    drawField(leftX, rowStartY + 0 * rowStep, "Driver's name: ", safeVal(driverName), "#111827")
    drawField(rightX, rowStartY + 0 * rowStep, "Truck plate: ", safeVal(truckPlate), "#111827")

    drawField(leftX, rowStartY + 1 * rowStep, "Trailer plate: ", safeVal(trailerPlate), "#111827")
    drawField(rightX, rowStartY + 1 * rowStep, "Inspection date: ", safeVal(checkDate), "#111827")

    drawField(leftX, rowStartY + 2 * rowStep, "Driving Licence expiry: ", dl.text, dl.color)
    drawField(rightX, rowStartY + 2 * rowStep, "ADR certificate expiry: ", adr.text, adr.color)

    drawField(leftX, rowStartY + 3 * rowStep, "Truck tehnical insp.: ", truckDoc.text, truckDoc.color)
    drawField(rightX, rowStartY + 3 * rowStep, "Trailer tehnical insp.: ", trailerDoc.text, trailerDoc.color)

    // Remarks (always show label; content optional)
    const remarksBoxX = cardX + 6
    const remarksBoxY = cardY + 34
    const remarksBoxW = cardW - 12
    const remarksBoxH = 10

    pdf.setDrawColor(226, 232, 240)
    pdf.setFillColor(255, 255, 255)
    // @ts-ignore
    pdf.roundedRect(remarksBoxX, remarksBoxY, remarksBoxW, remarksBoxH, 2, 2, "FD")

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.text("Remarks:", remarksBoxX + 2, remarksBoxY + 6.7)

    const trimmedRemarks = (remarks || "").trim()
    if (trimmedRemarks) {
      pdf.setTextColor(17, 24, 39)
      pdf.setFont("helvetica", "normal")

      const textX = remarksBoxX + 20
      const textY = remarksBoxY + 4.0
      const maxTextW = remarksBoxW - 22

      // Available height for remarks text inside the box (in mm)
      const textTop = textY
      const textBottom = remarksBoxY + remarksBoxH - 1.2
      const availableH = Math.max(0, textBottom - textTop)

      const baseFont = 8
      const minFont = 5
      const step = 0.25
      const ptToMm = 0.3527777778
      const defaultLhf =
        // @ts-ignore - exists at runtime
        typeof (pdf as any).getLineHeightFactor === "function" ? (pdf as any).getLineHeightFactor() : 1.15

      let fs = baseFont
      let lines: string[] = []
      let lhf = defaultLhf

      while (fs >= minFont) {
        pdf.setFontSize(fs)
        lines = pdf.splitTextToSize(trimmedRemarks, maxTextW) as string[]
        const lineH = fs * lhf * ptToMm
        const textH = lines.length * lineH
        if (textH <= availableH) break
        fs -= step
      }

      // If it's still too tall at min font, tighten line height a bit (keeps all text visible)
      if (fs < minFont) fs = minFont
      pdf.setFontSize(fs)
      lines = pdf.splitTextToSize(trimmedRemarks, maxTextW) as string[]
      const finalLineH = fs * lhf * ptToMm
      if (lines.length * finalLineH > availableH) {
        lhf = 1.0
      }

      pdf.text(lines, textX, textY, { lineHeightFactor: lhf })
    }

    // ---- Equipment checklist box ----
    const equipX = margin
    const equipY = cardY + cardH + gap
    const equipW = pageW - margin * 2
    const equipH = 84

    pdf.setDrawColor(226, 232, 240)
    pdf.setFillColor(255, 255, 255)
    pdf.setLineWidth(0.3)
    // @ts-ignore
    pdf.roundedRect(equipX, equipY, equipW, equipH, 3, 3, "FD")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(11)
    pdf.setTextColor(17, 24, 39)
    pdf.text("Equipment Checklist", equipX + 6, equipY + 8)

    const equipInnerY = equipY + 14
    const equipInnerX = equipX + 6
    const equipInnerW = equipW - 12
    const equipColGap = 10
    const equipColW = (equipInnerW - equipColGap) / 2

    const allEq = equipmentItems
    const half = Math.ceil(allEq.length / 2)
    const eqCols = [allEq.slice(0, half), allEq.slice(half)]
    const colXs = [equipInnerX, equipInnerX + equipColW + equipColGap]

    const eqRowH = 11

    const onePieceItems = new Set([
      "Flashlight",
      "Rubber gloves",
      "Safety glasses",
      "Mask + filter (ADR class 6.1/2.3)",
      "Collection bucket",
    ])

    for (let c = 0; c < 2; c++) {
      const col = eqCols[c]
      for (let i = 0; i < col.length; i++) {
        const item = col[i]
        const rowY = equipInnerY + i * eqRowH
        const x0 = colXs[c]

        const isChecked = !!checkedItems[item.name]
        const date = expiryDates[item.name]

        let expired = false
        if (item.hasDate && date?.month && date?.year) {
          const now = new Date()
          const expiry = new Date(`${date.year}-${date.month}-01`)
          expiry.setMonth(expiry.getMonth() + 1)
          expiry.setDate(0)
          expired = now > expiry
        }

        const ok = item.hasDate ? isChecked && !expired : isChecked

        drawStatus(x0, rowY - 4, ok)

        // icon box
        try {
          await drawIconBox(x0 + 6.2, rowY - 5.2, 7, item.image)
        } catch {
          // ignore missing icon
        }

        const textX = x0 + 6.2 + 8.5
        const maxTextW = equipColW - (textX - x0) - 2

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(9)
        pdf.setTextColor(17, 24, 39)

        if (item.hasDate && date?.month && date?.year) {
          const namePart = `${item.name} - `
          const dateStr = `${date.month}/${date.year}${expired ? " (EXPIRED)" : ""}`

          const nameFit = truncateToWidth(namePart, maxTextW * 0.65)
          pdf.text(nameFit, textX, rowY)

          pdf.setFont("helvetica", "bold")
          pdf.setTextColor(expired ? 185 : 22, expired ? 28 : 101, expired ? 28 : 52)
          const nameW = pdf.getTextWidth(nameFit)
          const dateFit = truncateToWidth(dateStr, maxTextW - nameW)
          pdf.text(dateFit, textX + nameW, rowY)

          pdf.setTextColor(17, 24, 39)
        } else {
          const nameFit = truncateToWidth(item.name, maxTextW)
          pdf.text(nameFit, textX, rowY)
        }

        // One piece note
        if (onePieceItems.has(item.name)) {
          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(6.5)
          pdf.setTextColor(185, 28, 28)
          pdf.text("One piece for each driver!", textX, rowY + 4)
          pdf.setTextColor(17, 24, 39)
        }
      }
    }

    // ---- Before/After loading (two boxes) ----
    const loadY = equipY + equipH + gap
    const loadWTotal = pageW - margin * 2
    const loadColGap = 10
    const boxW = (loadWTotal - loadColGap) / 2
    const boxH = 70

    const beforeX = margin
    const afterX = margin + boxW + loadColGap

    const drawLoadingBox = (title: string, x: number, y: number, items: string[], checkedMap: Record<string, boolean>) => {
      pdf.setDrawColor(226, 232, 240)
      pdf.setFillColor(255, 255, 255)
      pdf.setLineWidth(0.3)
      // @ts-ignore
      pdf.roundedRect(x, y, boxW, boxH, 3, 3, "FD")

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.setTextColor(17, 24, 39)
      pdf.text(title, x + 6, y + 8)

      let yy = y + 16
      const textX = x + 6 + 6.2
      const maxW = boxW - 14

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(7.8)

      // Line height used for checklist rows (keeps spacing consistent with existing layout)
      const rowH = 7

      for (const it of items) {
        const ok = !!checkedMap[it]
        drawStatus(x + 6, yy - 4, ok)

        // Special case: keep the "Goods correctly secured" item readable by wrapping after the colon
        // instead of truncating with an ellipsis.
        if (it.startsWith("Goods correctly secured:") && pdf.getTextWidth(it) > maxW) {
          const idx = it.indexOf(":")
          const head = idx >= 0 ? it.slice(0, idx + 1).trim() : "Goods correctly secured:"
          const tail = idx >= 0 ? it.slice(idx + 1).trim() : it

          // First line (label)
          pdf.text(truncateToWidth(head, maxW), textX, yy)

          // Following line(s) (description)
          const tailLines = (pdf as any).splitTextToSize ? (pdf as any).splitTextToSize(tail, maxW) : [tail]
          for (let j = 0; j < tailLines.length; j++) {
            pdf.text(String(tailLines[j]), textX, yy + rowH * (j + 1))
          }

          yy += rowH * (1 + tailLines.length)
          continue
        }

        const line = truncateToWidth(it, maxW)
        pdf.text(line, textX, yy)
        yy += rowH
      }
    }

    drawLoadingBox("Before Loading", beforeX, loadY, beforeLoadingItems, beforeLoadingChecked)
    drawLoadingBox("After Loading", afterX, loadY, afterLoadingItems, afterLoadingChecked)

    // ---- Signatures box ----
    const sigY = loadY + boxH + gap
    const sigX = margin
    const sigW = pageW - margin * 2
    const sigH = 34

    pdf.setDrawColor(226, 232, 240)
    pdf.setFillColor(255, 255, 255)
    pdf.setLineWidth(0.3)
    // @ts-ignore
    pdf.roundedRect(sigX, sigY, sigW, sigH, 3, 3, "FD")

    const sigInnerPad = 6
    const sigGap = 12
    const sigColW = (sigW - sigInnerPad * 2 - sigGap) / 2
    const leftSigX = sigX + sigInnerPad
    const rightSigX = sigX + sigInnerPad + sigColW + sigGap

    const sigImgW = sigColW
    const sigImgH = 16

    const drawSignatureArea = (x: number, imgData: string | null, labelText: string) => {
      // signature image / line
      if (imgData) {
        try {
          pdf.addImage(imgData, "PNG", x, sigY + 6, sigImgW, sigImgH)
        } catch {
          // fallback to line
          pdf.setDrawColor(148, 163, 184)
          pdf.setLineWidth(0.4)
          pdf.line(x, sigY + 22, x + sigImgW, sigY + 22)
        }
      } else {
        pdf.setDrawColor(148, 163, 184)
        pdf.setLineWidth(0.4)
        pdf.line(x, sigY + 22, x + sigImgW, sigY + 22)
      }

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(17, 24, 39)
      const line = truncateToWidth(labelText, sigColW)
      const w = pdf.getTextWidth(line)
      const cx = x + Math.max(0, (sigColW - w) / 2)
      pdf.text(line, cx, sigY + 30)
    }

    drawSignatureArea(leftSigX, signatureData, `Driver: ${safeVal(driverName)}`)
    drawSignatureArea(rightSigX, inspectorSignatureData, `Inspector: ${safeVal(selectedInspector)}`)

    await addWatermark()


    return pdf
  }
  // Generate ZIP (PDF + photos) and store in Supabase (60-day retention)
  const generateZIP = async () => {
    if (!isMounted || typeof window === "undefined") return

    setIsPdfGenerating(true)

    try {
      const pdf = await buildAdrPdf()

      // Build identity hash (used to dedupe between Download and Email)
      const uploadedPhotos = photos
        .filter((p) => p.status === "done" && !!p.url)
        .map((p) => ({ url: p.url as string, name: p.name, contentType: p.contentType }))

      const identity = {
        variant,
        driverName,
        truckPlate,
        trailerPlate,
        inspectionDate: checkDate,
        selectedInspector,
        remarks,
        drivingLicenseDate,
        adrCertificateDate,
        truckDocDate,
        trailerDocDate,
        checkedItems,
        beforeLoadingChecked,
        afterLoadingChecked,
        expiryDates,
        signatureData,
        inspectorSignatureData,
        photos: uploadedPhotos,
      }

      const checklistHash = await sha256Hex(stableStringify(identity))

      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()

      const baseName = `ADR-Check_${driverName.replace(/\s+/g, "_")}_${checkDate.replace(/-/g, ".")}`

      // PDF in ZIP
      const pdfBuffer = pdf.output("arraybuffer")
      zip.file(`${baseName}.pdf`, pdfBuffer)

      // Photos in ZIP (prefer IndexedDB blobs to avoid CORS issues with public storage URLs)
      const safeFileName = (name: string) => (name || "").replace(/[^a-zA-Z0-9._-]/g, "_")
      const photosForZip = photos.slice()

      for (let i = 0; i < photosForZip.length; i++) {
        const ph = photosForZip[i]
        let arrBuf: ArrayBuffer | null = null
        let fileName = safeFileName(ph.name || `photo_${i + 1}.jpg`)

        // 1) Try local IndexedDB (most reliable, works offline)
        try {
          const rec = await idbGetPhoto(ph.id)
          if (rec?.blob) {
            arrBuf = await rec.blob.arrayBuffer()
            if (rec.name) fileName = safeFileName(rec.name)
          }
        } catch {
          // ignore
        }

        // 2) Fallback: fetch uploaded URL (may fail on some storages due to CORS)
        if (!arrBuf && ph.url) {
          try {
            const resp = await fetch(ph.url)
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            arrBuf = await resp.arrayBuffer()
          } catch {
            // ignore
          }
        }

        // 3) Fallback: fetch preview blob URL (if still present)
        if (!arrBuf && ph.previewUrl) {
          try {
            const resp = await fetch(ph.previewUrl)
            if (resp.ok) arrBuf = await resp.arrayBuffer()
          } catch {
            // ignore
          }
        }

        if (arrBuf) {
          zip.file(`photos/${String(i + 1).padStart(2, "0")}_${fileName}`, arrBuf)
        }
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      })

      // Save to ADR Checklists History (DB row + upload ZIP to Supabase Storage when needed)
      try {
        const storeHeaders: Record<string, string> = { "Content-Type": "application/json" }
        if (session?.access_token) storeHeaders.Authorization = `Bearer ${session.access_token}`

        const storeRes = await fetch("/api/adr-store", {
          method: "POST",
          headers: storeHeaders,
          body: JSON.stringify({
            variant,
            checklistHash,
            emailSent: false,
            meta: {
              variant,
              driverName,
              truckPlate,
              trailerPlate,
              inspectionDate: checkDate,
              inspectorName: loggedInspectorName || selectedInspector,
              inspectorEmail: loggedInspectorEmail || undefined,
              photos: photos.map((p) => ({
                id: p.id,
                name: p.name,
                url: p.url || null,
                contentType: p.contentType || null,
                status: p.status,
              })),
            },
          }),
        })

        const storeData = await storeRes.json().catch(() => ({}))

        if (storeRes.ok && storeData?.success && storeData?.upload && storeData?.path && storeData?.token) {
          const { getSupabaseClient } = await import("@/lib/supabaseClient")
          const supabase = getSupabaseClient()
          const anyBucket: any = supabase.storage.from("adr-checklists")

          if (typeof anyBucket.uploadToSignedUrl === "function") {
            const zipUploadBlob = zipBlob.slice(0, zipBlob.size, "application/zip")
            const uploadResult = await anyBucket.uploadToSignedUrl(storeData.path, storeData.token, zipUploadBlob, {
              contentType: "application/zip",
            })
            if (uploadResult?.error) {
              console.warn("Supabase ZIP upload failed (download)", uploadResult.error)
            }
          } else {
            console.warn("Supabase client does not support uploadToSignedUrl (ZIP)")
          }
        } else if (!storeRes.ok || !storeData?.success) {
          console.warn("Supabase store failed (download)", storeData?.message || `HTTP ${storeRes.status}`)
        }
      } catch (e) {
        console.warn("Supabase store failed (download)", e)
      }

      // Download ZIP
      const zipName = `${baseName}.zip`
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = zipName

      // iOS Safari sometimes navigates instead of downloading; open in a new tab to avoid wiping the current page.
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : ""
      const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1)
      if (iOS) {
        a.target = "_blank"
        a.rel = "noopener noreferrer"
      }

      document.body.appendChild(a)
      a.click()
      a.remove()

      // Keep the same behavior as Send Email: after generating/downloading, reset the checklist.
      resetForm()

      setTimeout(() => {
        try {
          URL.revokeObjectURL(url)
        } catch {}
      }, 10_000)
    } catch (error) {
      console.error("Error generating ZIP:", error)
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

    // Reset signatures (important: these must run with the latest canvas refs)
    clearSignature()
    clearInspectorSignature()

    // Reset inspector
    setSelectedInspector(loggedInspectorName || "")

    // Reset remarks + photos
    setRemarks("")
    setPhotos((prev) => {
      prev.forEach((p) => {
        void idbDeletePhoto(p.id).catch(() => {})
        if (p.previewUrl) {
          try {
            URL.revokeObjectURL(p.previewUrl)
          } catch {
            // ignore
          }
        }
      })
      return []
    })

    // Reset other states
    setShowResult(false)
    setMissingItems([])
    setAllChecked(false)

    // Clear localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey)
    }
  }, [equipmentItems, beforeLoadingItems, afterLoadingItems, clearSignature, clearInspectorSignature, loggedInspectorName, storageKey])

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
  }, [isMounted, storageKey, includeAdrCertificate])

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

        // Restore signatures
        if (typeof parsedData.signatureData === "string") setSignatureData(parsedData.signatureData)
        if (typeof parsedData.inspectorSignatureData === "string") setInspectorSignatureData(parsedData.inspectorSignatureData)

        // Restore photos (metadata for both uploaded + pending). Image blobs live in IndexedDB.
        if (Array.isArray(parsedData.photos)) {
          const restored: UploadedPhoto[] = parsedData.photos
            .filter((p: any) => p && typeof p === "object" && typeof p.id === "string" && p.id.length > 0)
            .map((p: any) => {
              const status: UploadedPhoto["status"] = p.status === "done" ? "done" : "queued"
              const url = typeof p.url === "string" && p.url.length > 0 ? p.url : undefined
              return {
                id: p.id,
                name: typeof p.name === "string" ? p.name : "photo.jpg",
                previewUrl: url || "",
                status,
                progress: status === "done" ? 100 : 0,
                url,
                contentType: typeof p.contentType === "string" ? p.contentType : undefined,
                error: typeof p.error === "string" ? p.error : undefined,
              }
            })

          setPhotos(restored)

          // Hydrate preview thumbnails from IndexedDB (works offline, avoids CORS)
          ;(async () => {
            try {
              const hydrated = await Promise.all(
                restored.map(async (ph) => {
                  try {
                    const rec = await idbGetPhoto(ph.id)
                    if (rec?.blob) {
                      return {
                        id: ph.id,
                        previewUrl: URL.createObjectURL(rec.blob),
                        name: rec.name,
                        contentType: rec.contentType,
                      }
                    }
                  } catch {
                    // ignore
                  }
                  return null
                }),
              )

              setPhotos((prev) =>
                prev.map((ph) => {
                  const hit = hydrated.find((h) => h && h.id === ph.id)
                  if (!hit) return ph
                  if (ph.previewUrl && ph.previewUrl.startsWith("blob:") && ph.previewUrl !== hit.previewUrl) {
                    try {
                      URL.revokeObjectURL(ph.previewUrl)
                    } catch {
                      // ignore
                    }
                  }
                  return {
                    ...ph,
                    previewUrl: hit.previewUrl,
                    name: hit.name || ph.name,
                    contentType: hit.contentType || ph.contentType,
                  }
                }),
              )
            } catch {
              // ignore
            }
          })()
        }

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
  }, [isMounted, storageKey, includeAdrCertificate])


  // Restore signature drawings on the canvases after a refresh
  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return
    if (!signatureData) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new window.Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = signatureData
  }, [isMounted, signatureData])

  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return
    if (!inspectorSignatureData) return
    const canvas = inspectorCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new window.Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = inspectorSignatureData
  }, [isMounted, inspectorSignatureData])

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
      signatureData,
      inspectorSignatureData,
      // Persist photo metadata for both uploaded and pending photos.
      // Actual image data is kept in IndexedDB (idbPutPhoto) so drafts survive refresh/offline.
      photos: photos.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url || null,
        contentType: p.contentType || null,
        status: p.status,
        error: p.error || null,
      })),
    }

    localStorage.setItem(storageKey, JSON.stringify(dataToSave))
  }, [
    storageKey,
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
    signatureData,
    inspectorSignatureData,
    photos,
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
      setEmailStatus("Generating PDF...")

      const pdf = await buildAdrPdf()

      // IMPORTANT: do NOT send the PDF as base64 in JSON (can exceed Vercel body limits -> HTTP 413).
      // Instead, upload the PDF directly to Supabase Storage via a signed upload URL, then pass the storage path
      // to the email API. This keeps the UI/behavior the same while making the request small and reliable.
      const pdfArrBuf = pdf.output("arraybuffer") as ArrayBuffer
      if (!pdfArrBuf || (pdfArrBuf as any).byteLength === 0) throw new Error("Generated PDF is empty")

      const uploadedPhotos = photos
        .filter((p) => p.status === "done" && !!p.url)
        .map((p) => ({ url: p.url as string, name: p.name, contentType: p.contentType }))

      // Compute the same hash used by Download ZIP (so email updates the same DB entry).
      const identity = {
        variant,
        driverName,
        truckPlate,
        trailerPlate,
        inspectionDate: checkDate,
        selectedInspector,
        remarks,
        drivingLicenseDate,
        adrCertificateDate,
        truckDocDate,
        trailerDocDate,
        checkedItems,
        beforeLoadingChecked,
        afterLoadingChecked,
        expiryDates,
        signatureData,
        inspectorSignatureData,
        photos: uploadedPhotos,
      }
      const checklistHash = await sha256Hex(stableStringify(identity))

      setEmailStatus("Uploading PDF...")
      const presignRes = await fetch("/api/presign-pdf-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistHash, variant }),
      })
      const presignData = await presignRes.json().catch(() => ({}))
      if (!presignRes.ok || !presignData?.success || !presignData?.bucket || !presignData?.path || !presignData?.token) {
        throw new Error(presignData?.message || `PDF presign failed (${presignRes.status})`)
      }

      // Upload to Supabase Storage using the signed upload token.
      // Use 'any' to stay compatible with supabase-js minor changes.
      const { getSupabaseClient } = await import("@/lib/supabaseClient")
      const supabase = getSupabaseClient()
      const anyBucket: any = supabase.storage.from(presignData.bucket)
      if (typeof anyBucket.uploadToSignedUrl !== "function") {
        throw new Error("Supabase client does not support uploadToSignedUrl")
      }

      const pdfBlob = new Blob([pdfArrBuf], { type: "application/pdf" })
      const uploadResult = await anyBucket.uploadToSignedUrl(presignData.path, presignData.token, pdfBlob, {
        contentType: "application/pdf",
      })
      if (uploadResult?.error) {
        throw new Error(uploadResult.error.message || "Failed to upload PDF")
      }

      setEmailStatus("Sending email...")

      const authHeaders: Record<string, string> = { "Content-Type": "application/json" }
      if (session?.access_token) authHeaders.Authorization = `Bearer ${session.access_token}`

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          inspectorName: loggedInspectorName || selectedInspector,
          inspectorEmail: loggedInspectorEmail || undefined,
          // Keep the payload small; the server will download from Storage.
          pdfStoragePath: presignData.path,
          driverName,
          truckPlate,
          trailerPlate,
          inspectionDate: checkDate,
          remarks,
          photos: uploadedPhotos,
          variant,
          checklistHash,
          meta: {
            variant,
            driverName,
            truckPlate,
            trailerPlate,
            inspectionDate: checkDate,
            inspectorName: loggedInspectorName || selectedInspector,
          },
        }),
      })

      const data = await response.json().catch(() => ({}))

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
    <>
      {confirmAction && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmAction(null)} />
          <div className="relative w-[min(92vw,420px)] rounded-2xl bg-white shadow-2xl border border-gray-200 p-5">
            <div className="font-semibold mb-2">Confirm</div>
            <div className="text-sm text-gray-600 mb-5">
              {confirmAction === "download" ? "Download ZIP?" : "Send ZIP via Email?"}
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent"
                onClick={() => setConfirmAction(null)}
              >
                No
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const action = confirmAction
                  setConfirmAction(null)
                  if (action === "send") await handleSendEmail()
                  else if (action === "download") await generateZIP()
                }}
                disabled={isSendingEmail || isPdfGenerating}
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto py-4 max-w-4xl relative z-30 bg-white bg-opacity-90 rounded-lg shadow-lg my-8">
      <div className="relative text-center mb-6">
        <h1 id="adr-title" className="text-2xl font-bold">
          ADR Checklist{variant === "under1000" ? " (Under 1000 pts)" : ""}
        </h1>

        {/* If we ever render without a Back button, keep the inspector badge visible (same style). */}
        {!onBack && selectedInspector && (
          <div
            className="absolute right-0 top-0 rounded-md px-3 py-1 text-sm font-semibold text-white"
            style={{ backgroundColor: INSPECTOR_COLORS[selectedInspector] || "#111827" }}
          >
            {selectedInspector}
          </div>
        )}
      </div>

      {onBack && (
        <div className="flex items-center justify-between mb-4">
          <Button type="button" variant="outline" className="bg-transparent" onClick={onBack}>
            ← Back
          </Button>

          {selectedInspector ? (
            <div
              className="rounded-md px-3 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: INSPECTOR_COLORS[selectedInspector] || "#111827" }}
            >
              {selectedInspector}
            </div>
          ) : (
            <div />
          )}
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
        {/* Remarks + Photos (above signatures) */}
        <div className="mt-4">
          <Label htmlFor="remarks" className="block mb-2">
            Remarks:
          </Label>
          <textarea
            id="remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add any remarks here..."
            className="w-full min-h-[90px] rounded-md border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-black/20"
          />

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <Button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="bg-black text-white hover:brightness-95"
                >
                  Upload photos
                </Button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handlePhotoInputChange}
                />
                <p className="mt-1 text-xs text-gray-600">Camera will open on mobile.</p>
              </div>

              {/* Thumbnails */}
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative h-16 w-16 overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                    title={p.name}
                  >
                    <img
                      src={p.previewUrl}
                      alt={p.name}
                      className={`h-full w-full object-cover transition-opacity ${p.status === "uploading" || p.status === "queued" ? "opacity-60" : "opacity-100"}`}
                    />

                    {/* Progress bar overlay */}
                    {(p.status === "uploading" || p.status === "queued") && (
                      <div className="absolute inset-x-0 bottom-0 h-2 bg-black/10">
                        <div className="h-full bg-black/70" style={{ width: `${p.progress}%` }} />
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 rounded bg-black/70 px-1 text-xs text-white opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    >
                      ×
                    </button>

                    {/* Error badge */}
                    {p.status === "error" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-600/70 text-[10px] font-semibold text-white">
                        Error
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

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
        <Button type="button" onClick={() => setConfirmAction("download")} disabled={isPdfGenerating} className="w-full">
          {isPdfGenerating ? "Generating ZIP..." : "Download ZIP"}
        </Button>
        <Button
          type="button"
          onClick={() => setConfirmAction("send")}
          disabled={
            isSendingEmail ||
            isPdfGenerating ||
            !selectedInspector ||
            photos.some((p) => p.status === "uploading" || p.status === "queued")
          }
          style={{ backgroundColor: "#0099d0" }}
          className="w-full hover:brightness-90"
        >
          {isSendingEmail ? "Sending Email..." : "Send ZIP via Email"}
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
    </>
  )
}
