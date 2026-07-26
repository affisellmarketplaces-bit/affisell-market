"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Html, Line, OrbitControls, Stars } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import gsap from "gsap"

import type { LiveEvent } from "@/lib/radar/live-types"

const EARTH_RADIUS = 100
const EARTH_TEXTURE =
  "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg"
const EARTH_FALLBACK =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/planets/earth_atmos_2048.jpg"

export function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function pinColor(event: LiveEvent): string {
  if (event.type === "sale") return "#22c55e"
  if (event.type === "import") return "#a78bfa"
  if (event.growth >= 300) return "#ef4444"
  return "#f97316"
}

function GlobeMesh() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin("anonymous")
    let cancelled = false
    loader.load(
      EARTH_TEXTURE,
      (tex) => {
        if (!cancelled) {
          tex.colorSpace = THREE.SRGBColorSpace
          setTexture(tex)
        }
      },
      undefined,
      () => {
        loader.load(EARTH_FALLBACK, (tex) => {
          if (!cancelled) {
            tex.colorSpace = THREE.SRGBColorSpace
            setTexture(tex)
          }
        })
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <mesh>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? "#ffffff" : "#0b1a33"}
        roughness={0.85}
        metalness={0.05}
        emissive="#1e1b4b"
        emissiveIntensity={0.12}
      />
    </mesh>
  )
}

function SpikePin({
  event,
  onSelect,
}: {
  event: LiveEvent
  onSelect: (e: LiveEvent) => void
}) {
  const group = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const pos = useMemo(
    () => latLngToVec3(event.location.lat, event.location.lng, EARTH_RADIUS + 1.2),
    [event.location.lat, event.location.lng]
  )
  const color = pinColor(event)

  useEffect(() => {
    if (!mesh.current) return
    mesh.current.scale.setScalar(0.01)
    const tween = gsap.to(mesh.current.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.55,
      ease: "back.out(2.2)",
      delay: (hash(event.id) % 20) / 40,
    })
    const pulse = gsap.to(mesh.current.scale, {
      x: 1.25,
      y: 1.25,
      z: 1.25,
      duration: 1.1,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      delay: 0.6,
    })
    return () => {
      tween.kill()
      pulse.kill()
    }
  }, [event.id])

  useFrame((_, delta) => {
    if (!mesh.current) return
    mesh.current.rotation.y += delta * 0.6
  })

  return (
    <group ref={group} position={pos}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(event)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = "auto"
        }}
      >
        <sphereGeometry args={[2.2, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hover ? 1.2 : 0.65}
          roughness={0.35}
        />
      </mesh>
      {hover ? (
        <Html distanceFactor={140} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg border border-white/15 bg-zinc-950/90 px-2 py-1 text-[10px] text-white shadow-xl backdrop-blur">
            {event.product.title.slice(0, 36)}
            {" — "}
            {event.salesPerHour} ventes/h — {event.location.city}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

function ArcLine({ event }: { event: LiveEvent }) {
  const { curve, points } = useMemo(() => {
    const start = latLngToVec3(
      event.supplierLocation.lat,
      event.supplierLocation.lng,
      EARTH_RADIUS + 0.5
    )
    const end = latLngToVec3(event.location.lat, event.location.lng, EARTH_RADIUS + 0.5)
    const mid = start.clone().add(end).multiplyScalar(0.5)
    mid.normalize().multiplyScalar(EARTH_RADIUS * 1.35)
    const c = new THREE.QuadraticBezierCurve3(start, mid, end)
    const pts = c.getPoints(48)
    return {
      curve: c,
      points: pts.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    }
  }, [event])

  const particle = useRef<THREE.Mesh>(null)
  const t = useRef(Math.random())

  useFrame((_, delta) => {
    t.current = (t.current + delta * 0.12) % 1
    if (particle.current) {
      const p = curve.getPoint(t.current)
      particle.current.position.copy(p)
    }
  })

  return (
    <group>
      <Line points={points} color="#a78bfa" lineWidth={1} transparent opacity={0.4} />
      <mesh ref={particle}>
        <sphereGeometry args={[1.1, 10, 10]} />
        <meshBasicMaterial color="#c4b5fd" />
      </mesh>
    </group>
  )
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Scene({
  events,
  onSelect,
}: {
  events: LiveEvent[]
  onSelect: (e: LiveEvent) => void
}) {
  const pins = events.slice(0, 50)
  // Cap arcs for perf — show for spikes + first sales
  const arcs = pins.filter((e, i) => e.type === "spike" || i < 12)

  return (
    <>
      <color attach="background" args={["#050507"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 3, 5]} intensity={0.9} />
      <directionalLight position={[-4, -2, -3]} intensity={0.25} color="#818cf8" />
      <Stars radius={320} depth={60} count={2500} factor={3} saturation={0} fade speed={0.4} />
      <GlobeMesh />
      {pins.map((e) => (
        <SpikePin key={e.id} event={e} onSelect={onSelect} />
      ))}
      {arcs.map((e) => (
        <ArcLine key={`arc_${e.id}`} event={e} />
      ))}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={180}
        maxDistance={350}
        autoRotate
        autoRotateSpeed={0.35}
        rotateSpeed={0.55}
      />
    </>
  )
}

type Props = {
  events: LiveEvent[]
  onSelect: (e: LiveEvent) => void
}

/**
 * Full-viewport Affisell Radar Globe (client-only / WebGL).
 */
export default function Globe3D({ events, onSelect }: Props) {
  return (
    <div className="absolute inset-0 touch-none" data-testid="radar-globe-canvas">
      <Canvas
        camera={{ position: [0, 40, 250], fov: 45, near: 1, far: 2000 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <Scene events={events} onSelect={onSelect} />
      </Canvas>
    </div>
  )
}
