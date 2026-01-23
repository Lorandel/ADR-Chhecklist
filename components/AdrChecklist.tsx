"use client"

import type { RefObject, ChangeEvent } from "react"
import { useState, useEffect, useRef, useCallback, createRef, useMemo } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"
import { compressImageFile } from "@/lib/imageCompress"

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

  // Remarks + photo uploads
  const [remarks, setRemarks] = useState("")
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const uploadXhrRefs = useRef<Record<string, XMLHttpRequest>>({})

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
          const message = res?.message || res?.error || `Upload failed (${xhr.status})`
          setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: "error", error: message } : p)))
          reject(new Error(message))
        }

        xhr.onerror = () => {
          const message = "Upload failed (network error)"
          setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: "error", error: message } : p)))
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
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`
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

    // Start uploads
    await Promise.all(
      newPhotos.map(async (p, idx) => {
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

        try {
          await uploadPhoto(fileToUpload, p.id)
        } catch {
          // State already updated in uploadPhoto
        }
      }),
    )

    // Allow selecting the same file again
    e.target.value = ""
  }

  const removePhoto = (photoId: string) => {
    const xhr = uploadXhrRefs.current[photoId]
    if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
      try {
        xhr.abort()
      } catch {
        // ignore
      }
    }

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


  // ---- PDF rendering helpers (used for Download PDF + Send Email) ----
  const BRAND_RED = "#D82C2D" // picked from watermark dominant red

  const loadImageDataUrl = async (url: string, cache: Map<string, string>) => {
    const cached = cache.get(url)
    if (cached) return cached

    const dataUrl = await fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`)
        return res.blob()
      })
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          }),
      )

    cache.set(url, dataUrl)
    return dataUrl
  }

  const renderAdrChecklistPdf = async (pdf: any) => {
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 18
    let y = 18

    // watermark (kept same)
    try {
      const watermarkUrl = "/images/albias-watermark.png"
      const watermarkImage = await fetch(watermarkUrl)
        .then((res) => res.blob())
        .then(
          (blob) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.readAsDataURL(blob)
            }),
        )

      pdf.addImage(watermarkImage, "PNG", pageWidth / 2 - 50, pageHeight / 2 - 50, 100, 100, undefined, "NONE", 0.1)
    } catch {
      // ignore watermark errors
    }

    const inspectorColors: Record<string, string> = {
      "Alexandru Dogariu": "#FF8C00",
      "Robert Kerekes": "#8B4513",
      "Eduard Tudose": "#000000",
      "Angela Ilis": "#FF69B4",
      "Lucian Sistac": "#1E90FF",
      "Martian Gherasim": "#008000",
      "Alexandru Florea": "#DAA520",
    }

    const drawCheckbox = (x: number, yTop: number, checked: boolean) => {
      const s = 5
      const r = 0.9
      pdf.setDrawColor(60)
      pdf.setLineWidth(0.45)
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x, yTop, s, s, r, r, "FD")

      if (checked) {
        pdf.setDrawColor(0, 120, 0)
        pdf.setLineWidth(1.0)
        pdf.line(x + 1.0, yTop + 2.7, x + 2.1, yTop + 3.9)
        pdf.line(x + 2.0, yTop + 3.9, x + 4.2, yTop + 1.2)
      } else {
        pdf.setDrawColor(200, 0, 0)
        pdf.setLineWidth(0.95)
        pdf.line(x + 1.0, yTop + 1.0, x + 4.0, yTop + 4.0)
        pdf.line(x + 4.0, yTop + 1.0, x + 1.0, yTop + 4.0)
      }
      pdf.setDrawColor(0)
      pdf.setLineWidth(0.3)
    }

    const addBold = (text: string, x: number, y: number, options: any = {}, color = "#000000") => {
      pdf.setTextColor(color)
      pdf.setFont("helvetica", "bold")
      pdf.text(text, x, y, options)
      pdf.setTextColor("#000000")
    }

    const addNormalWrapped = (text: string, x: number, y: number, maxWidth: number, lineH = 4.6) => {
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor("#000000")
      const wrapped = pdf.splitTextToSize(text, maxWidth)
      pdf.text(wrapped, x, y)
      return { lines: wrapped.length, height: wrapped.length * lineH }
    }

    const addKeyValue = (label: string, value: string, x: number, y: number, valueColor = "#191970") => {
      const labelColW = 34
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor("#000000")
      pdf.text(label, x, y)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(valueColor)
      pdf.text(value || "-", x + labelColW, y)
      pdf.setTextColor("#000000")
    }

    pdf.setFontSize(20)
    addBold("ADR Checklist", pageWidth / 2, y, { align: "center" }, BRAND_RED)
    y += 8.5

    pdf.setFontSize(11)

    const infoLines: Array<{ label: string; value: string; color?: string }> = [
      { label: "Driver:", value: driverName, color: "#191970" },
      { label: "Truck:", value: truckPlate, color: "#191970" },
      { label: "Trailer:", value: trailerPlate, color: "#191970" },
    ]

    if (drivingLicenseDate.month && drivingLicenseDate.year) {
      const expired = drivingLicenseExpired
      infoLines.push({
        label: "Driving licence:",
        value: `${drivingLicenseDate.month}/${drivingLicenseDate.year}${expired ? " (EXPIRED)" : ""}`,
        color: expired ? "#FF0000" : "#006400",
      })
    }

    if (includeAdrCertificate && adrCertificateDate.month && adrCertificateDate.year) {
      const expired = adrCertificateExpired
      infoLines.push({
        label: "ADR cert:",
        value: `${adrCertificateDate.month}/${adrCertificateDate.year}${expired ? " (EXPIRED)" : ""}`,
        color: expired ? "#FF0000" : "#006400",
      })
    }

    if (truckDocDate.month && truckDocDate.year) {
      const expired = truckDocExpired
      infoLines.push({
        label: "Truck doc:",
        value: `${truckDocDate.month}/${truckDocDate.year}${expired ? " (EXPIRED)" : ""}`,
        color: expired ? "#FF0000" : "#006400",
      })
    }

    if (trailerDocDate.month && trailerDocDate.year) {
      const expired = trailerDocExpired
      infoLines.push({
        label: "Trailer doc:",
        value: `${trailerDocDate.month}/${trailerDocDate.year}${expired ? " (EXPIRED)" : ""}`,
        color: expired ? "#FF0000" : "#006400",
      })
    }

    infoLines.push({ label: "Date:", value: checkDate, color: "#191970" })

    for (const line of infoLines) {
      addKeyValue(line.label, line.value, margin, y, line.color || "#191970")
      y += 5.6
    }

    const trimmedRemarks = remarks.trim()
    if (trimmedRemarks) {
      y += 1.5
      addBold("Remarks:", margin, y, {}, BRAND_RED)
      y += 5.2
      const { height } = addNormalWrapped(trimmedRemarks, margin, y, pageWidth - margin * 2, 4.6)
      y += height + 2.5
      pdf.setFont("helvetica", "bold")
    }

    y += 2
    pdf.setFontSize(11)
    addBold("Equipment Checklist", margin, y, {}, BRAND_RED)
    y += 6.2

    const imgCache = new Map<string, string>()
    const imgSize = 6.5

    const leftColumnItems = equipmentItems.slice(0, 6)
    const rightColumnItems = equipmentItems.slice(6)
    const columnGap = 10
    const leftX = margin
    const rightX = pageWidth / 2 + columnGap
    const columnW = pageWidth / 2 - margin - columnGap
    const columnHeight = Math.max(leftColumnItems.length, rightColumnItems.length)
    const rowH = 8

    const renderEquipment = async (item: any, colX: number, rowY: number) => {
      if (!item) return

      const isChecked = !!checkedItems[item.name]
      const date = expiryDates[item.name]

      drawCheckbox(colX, rowY - 4.7, isChecked)

      const textX = colX + 6.3
      const baselineY = rowY
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor("#000000")

      let label = item.name
      let dateStr = ""
      let expired = false

      if (item.hasDate && date?.month && date?.year) {
        const now = new Date()
        const expiry = new Date(`${date.year}-${date.month}-01`)
        expiry.setMonth(expiry.getMonth() + 1)
        expiry.setDate(0)
        expired = now > expiry
        dateStr = `${date.month}/${date.year}${expired ? " (EXPIRED)" : ""}`
        label = `${item.name} -`
      }

      pdf.text(label, textX, baselineY)
      let afterTextX = textX + pdf.getTextWidth(label) + 1.6

      if (dateStr) {
        pdf.setTextColor(expired ? "#FF0000" : "#006400")
        pdf.text(dateStr, afterTextX, baselineY)
        afterTextX += pdf.getTextWidth(dateStr) + 1.6
        pdf.setTextColor("#000000")
      }

      if (
        item.name === "Flashlight" ||
        item.name === "Rubber gloves" ||
        item.name === "Safety glasses" ||
        item.name === "Mask + filter (ADR class 6.1/2.3)" ||
        item.name === "Collection bucket"
      ) {
        pdf.setTextColor("#B00000")
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(9.5)
        pdf.text("One piece for each driver!", textX, baselineY + 4)
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "bold")
        pdf.setTextColor("#000000")
      }

      if (item.image) {
        try {
          const dataUrl = await loadImageDataUrl(item.image, imgCache)
          const maxX = colX + columnW - imgSize
          const imgX = Math.min(afterTextX, maxX)
          const imgY = baselineY - imgSize + 1.4
          pdf.addImage(dataUrl, "PNG", imgX, imgY, imgSize, imgSize)
        } catch {
          // ignore
        }
      }
    }

    for (let i = 0; i < columnHeight; i++) {
      const rowY = y + i * rowH
      await renderEquipment(leftColumnItems[i], leftX, rowY)
      await renderEquipment(rightColumnItems[i], rightX, rowY)
    }

    y += columnHeight * rowH + 8

    pdf.setFontSize(11)
    addBold("Before Loading", margin, y, {}, BRAND_RED)
    y += 6
    for (const item of beforeLoadingItems) {
      drawCheckbox(margin, y - 4.7, !!beforeLoadingChecked[item])
      addBold(item, margin + 6.3, y)
      y += 5.6
    }

    y += 2
    addBold("After Loading", margin, y, {}, BRAND_RED)
    y += 6
    for (const item of afterLoadingItems) {
      drawCheckbox(margin, y - 4.7, !!afterLoadingChecked[item])
      addBold(item, margin + 6.3, y)
      y += 5.6
    }

    y += 8
    pdf.setFontSize(10.5)

    if (signatureData) {
      pdf.addImage(signatureData, "PNG", margin, y, 70, 20)
      addBold("Driver Signature", margin, y + 25)
    } else {
      pdf.setDrawColor(0, 71, 171)
      pdf.setLineWidth(0.5)
      pdf.line(margin, y + 20, margin + 70, y + 20)
      addBold("Driver Signature (Not Signed)", margin, y + 25)
    }

    const inspectorX = pageWidth - margin - 70
    if (inspectorSignatureData) {
      pdf.addImage(inspectorSignatureData, "PNG", inspectorX, y, 70, 20)
    } else {
      pdf.setDrawColor(0, 71, 171)
      pdf.setLineWidth(0.5)
      pdf.line(inspectorX, y + 20, inspectorX + 70, y + 20)
    }

    const inspectorColor = inspectorColors[selectedInspector] || "#000000"
    const inspectorLabel = "Inspector:"
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor("#000000")
    pdf.text(inspectorLabel, inspectorX, y + 25)
    const labelW = pdf.getTextWidth(inspectorLabel) + 2
    pdf.setTextColor(inspectorColor)
    pdf.text(selectedInspector || "Not selected", inspectorX + labelW, y + 25)
    pdf.setTextColor("#000000")
  }

  // Generate PDF report
  const generatePDF = async () => {
    if (!isMounted || typeof window === "undefined") return

    setIsPdfGenerating(true)
    try {
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      await renderAdrChecklistPdf(pdf)

      console.log("PDF content generated successfully")
      setEmailStatus("PDF generated, preparing to send email...")

      // Convert PDF to base64
      let pdfBase64 = ""
      try {
        const pdfBuffer = pdf.output("arraybuffer")
        // @ts-ignore - Buffer is available in Next.js (browser polyfill)
        pdfBase64 = Buffer.from(pdfBuffer).toString("base64")
        if (!pdfBase64 || pdfBase64.length === 0) throw new Error("Generated PDF is empty")
      } catch (convError: any) {
        console.error("Error processing PDF:", convError)
        throw new Error(`PDF processing error: ${convError.message}`)
      }

      setEmailStatus("Sending email...")

      const uploadedPhotos = photos
        .filter((p) => p.status === "done" && !!p.url)
        .map((p) => ({ url: p.url as string, name: p.name, contentType: p.contentType }))

      // Send email
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
          remarks,
          photos: uploadedPhotos,
        }),
      })

      const data = await response.json().catch(() => ({}))
      console.log("API response status:", response.status)
      console.log("API response data:", data)

      if (!response.ok) {
        throw new Error(data.message || `Server responded with status ${response.status}`)
      }

      if (data.success) {
        setEmailStatus("Email sent successfully!")
        resetForm()
      } else {
        setEmailStatus(data.message || "Email sent successfully!")
      }
    } catch (err) {
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

        {/* Remarks + Photos (below inspector select, above signatures) */}
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
        <Button onClick={generatePDF} disabled={isPdfGenerating} className="w-full">
          {isPdfGenerating ? "Generating PDF..." : "Download PDF"}
        </Button>
        <Button
          onClick={handleSendEmail}
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
  )
}
