/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  AlertCircle, 
  Users, 
  Calendar, 
  Settings, 
  Menu, 
  X,
  Radio,
  Bell,
  Search,
  ChevronRight,
  ShieldAlert,
  Activity,
  Map as MapIcon,
  MessageSquare,
  Clock,
  ArrowUpRight,
  Plus,
  ArrowLeft,
  FileText,
  Megaphone,
  Send,
  Share2,
  MousePointer2,
  Maximize2,
  ArrowRight,
  CheckCircle2,
  Wifi,
  Zap,
  Layers,
  Info,
  Trash2,
  Edit2
} from 'lucide-react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Marker as LeafletMarker } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-geometryutil';
import 'leaflet.heat';
import { GoogleGenAI, Type } from "@google/genai";
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useMap } from 'react-leaflet';
import { BroadcastPage } from './components/BroadcastPage';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const HeatmapLayer = ({ points }: { points: [number, number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heatLayer = (L as any).heatLayer(points, {
      radius: 35,
      blur: 20,
      maxZoom: 18,
      max: 1.0,
      gradient: {
        0.2: '#3b82f6', // blue
        0.4: '#06b6d4', // cyan
        0.6: '#10b981', // emerald
        0.8: '#f59e0b', // amber
        1.0: '#ef4444'  // red
      }
    }).addTo(map);
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);
  return null;
};

const MapAutoCenter = ({ polygon, padding = [50, 50] }: { polygon: [number, number][] | null, padding?: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (polygon && polygon.length > 0) {
      const bounds = L.latLngBounds(polygon);
      map.fitBounds(bounds, { padding });
    }
  }, [map, polygon, padding]);
  return null;
};

const VenueMask = ({ polygon }: { polygon: [number, number][] | null }) => {
  if (!polygon || polygon.length === 0) return null;
  const outerBounds: [number, number][] = [[90, -180], [90, 180], [-90, 180], [-90, -180]];
  return (
    <Polygon
      positions={[outerBounds, polygon]}
      pathOptions={{
        fillColor: 'white',
        fillOpacity: 1,
        color: 'white',
        weight: 0
      }}
    />
  );
};

type EventStatus = 'Live' | 'Scheduled' | 'Archived' | 'Draft';

interface Event {
  id: number;
  name: string;
  location: string;
  attendance: string;
  startDate: string;
  endDate: string;
  type?: string;
  venuePolygon?: [number, number][];
  nodes?: {id: number, x: number, y: number, status: 'online' | 'warning' | 'offline'}[];
  placedElements?: {id: number, type: string, name: string, x: number, y: number}[];
}

const getEventStatus = (startDate: string, endDate: string): EventStatus => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set times to midnight for date-only comparison
  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (now < start) return 'Scheduled';
  if (now > end) return 'Archived';
  return 'Live';
};

export default function App() {
  const today = new Date().toISOString().split('T')[0];
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [dashboardPage, setDashboardPage] = useState<'live' | 'network' | 'crowd' | 'safety' | 'nodes' | 'reports' | 'broadcast'>('live');
  const [crowdBlobs, setCrowdBlobs] = useState<{id: number, x: number, y: number, r: number, intensity: 'low' | 'med' | 'high' | 'critical'}[]>([]);
  const [coverageGaps, setCoverageGaps] = useState<{id: number, x: number, y: number, r: number, reason: string}[]>([]);
  const [meshPulse, setMeshPulse] = useState(0);

  useEffect(() => {
    if (selectedEvent) {
      if (selectedEvent.venuePolygon) setVenuePolygon(selectedEvent.venuePolygon);
      if (selectedEvent.nodes) setNodes(selectedEvent.nodes);
      if (selectedEvent.placedElements) setPlacedElements(selectedEvent.placedElements);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedEvent && dashboardPage === 'live') {
      // Initialize crowd blobs
      const initialBlobs = [
        { id: 1, x: 30, y: 40, r: 15, intensity: 'high' as const },
        { id: 2, x: 70, y: 60, r: 20, intensity: 'med' as const },
        { id: 3, x: 50, y: 30, r: 12, intensity: 'low' as const },
        { id: 4, x: 20, y: 80, r: 18, intensity: 'med' as const },
        { id: 5, x: 85, y: 20, r: 10, intensity: 'critical' as const },
      ];
      setCrowdBlobs(initialBlobs);

      const initialGaps = [
        { id: 1, x: 55, y: 75, r: 12, reason: 'Coverage Gap: Sector D' },
        { id: 2, x: 15, y: 25, r: 8, reason: 'Mesh Bridge Required' },
      ];
      setCoverageGaps(initialGaps);

      const interval = setInterval(() => {
        setCrowdBlobs(prev => prev.map(blob => ({
          ...blob,
          x: blob.x + (Math.random() - 0.5) * 0.5,
          y: blob.y + (Math.random() - 0.5) * 0.5,
        })));
        setMeshPulse(p => (p + 1) % 100);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedEvent, dashboardPage]);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [creationStep, setCreationStep] = useState(1);
  const [events, setEvents] = useState<Event[]>([
    { 
      id: 1, 
      name: 'Summer Solstice Festival 2026', 
      location: 'Berlin, DE', 
      attendance: '14,282',
      startDate: '2026-06-21',
      endDate: '2026-06-23',
      type: 'Music Festival',
      venuePolygon: [
        [52.5200, 13.4050],
        [52.5210, 13.4050],
        [52.5210, 13.4070],
        [52.5200, 13.4070]
      ],
      nodes: [
        { id: 1, x: 20, y: 30, status: 'online' },
        { id: 2, x: 50, y: 50, status: 'online' },
        { id: 3, x: 80, y: 70, status: 'online' },
        { id: 4, x: 30, y: 80, status: 'online' },
        { id: 5, x: 70, y: 20, status: 'online' }
      ],
      placedElements: [
        { id: 1, type: 'Stage', name: 'Main Stage', x: 50, y: 10 },
        { id: 2, type: 'Entrance', name: 'North Gate', x: 10, y: 50 }
      ]
    },
    { 
      id: 2, 
      name: 'Winter Gala Concert', 
      location: 'Vienna, AT', 
      attendance: '0',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      type: 'Conference',
      venuePolygon: [
        [48.2082, 16.3738],
        [48.2092, 16.3738],
        [48.2092, 16.3758],
        [48.2082, 16.3758]
      ],
      nodes: [
        { id: 1, x: 40, y: 40, status: 'online' },
        { id: 2, x: 60, y: 60, status: 'online' }
      ],
      placedElements: []
    },
    { 
      id: 3, 
      name: 'Tech Summit Expo', 
      location: 'San Francisco, US', 
      attendance: '5,400',
      startDate: '2025-11-10',
      endDate: '2025-11-12',
      type: 'Conference',
      venuePolygon: [
        [37.7749, -122.4194],
        [37.7759, -122.4194],
        [37.7759, -122.4174],
        [37.7749, -122.4174]
      ],
      nodes: [
        { id: 1, x: 25, y: 25, status: 'online' },
        { id: 2, x: 75, y: 75, status: 'online' }
      ],
      placedElements: []
    },
  ]);

  // Step 1 Data
  const [newEventData, setNewEventData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    attendance: '',
    type: 'Music Festival'
  });

  // Step 2 Data
  const [address, setAddress] = useState('');
  const [venueSize, setVenueSize] = useState<string | null>(null);
  const [venuePolygon, setVenuePolygon] = useState<[number, number][] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([52.52, 13.405]); // Berlin default
  const mapRef = useRef<L.Map | null>(null);

  // Step 3 Data (Placed Elements)
  const [placedElements, setPlacedElements] = useState<{id: number, type: string, name: string, x: number, y: number}[]>([]);
  const [namingElement, setNamingElement] = useState<{type: string} | null>(null);
  const [tempName, setTempName] = useState('');
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Step 4 Data (AI Nodes)
  const [nodes, setNodes] = useState<{id: number, x: number, y: number, status: 'online' | 'warning' | 'offline'}[]>([]);
  const [isAiPlanning, setIsAiPlanning] = useState(false);

  const getLatLngFromXY = (x: number, y: number, polygon: [number, number][]) => {
    if (!polygon || polygon.length === 0) return { lat: 0, lng: 0 };
    const lats = polygon.map(p => p[0]);
    const lngs = polygon.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const lat = maxLat - (y / 100) * (maxLat - minLat);
    const lng = minLng + (x / 100) * (maxLng - minLng);
    return { lat, lng };
  };

  const getXYFromLatLng = (lat: number, lng: number, polygon: [number, number][]) => {
    if (!polygon || polygon.length === 0) return { x: 0, y: 0 };
    const lats = polygon.map(p => p[0]);
    const lngs = polygon.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  const handleCreateEvent = () => {
    setIsCreatingEvent(true);
    setCreationStep(1);
  };

  const geocodeAddress = async () => {
    if (!address) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 16);
        }
      }
    } catch (error) {
      console.error("Geocoding failed", error);
    }
  };

  const onCreated = (e: any) => {
    const layer = e.layer;
    if (layer instanceof L.Polygon) {
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const coords = latlngs.map(ll => [ll.lat, ll.lng] as [number, number]);
      setVenuePolygon(coords);
      
      // Calculate area (approximate)
      const area = (L as any).GeometryUtil.geodesicArea(latlngs);
      setVenueSize(`${Math.round(area).toLocaleString()} m²`);
    }
  };

  const runAiNodePlanner = async () => {
    setIsAiPlanning(true);
    setCreationStep(4);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `
        As an expert event safety network engineer, plan the placement of network seed nodes for a festival venue.
        Venue Polygon (lat, lng): ${JSON.stringify(venuePolygon)}
        Placed Elements: ${JSON.stringify(placedElements)}
        
        Requirements:
        1. Ensure coverage for all placed elements (Stages, Entrances, etc.).
        2. Provide at least 8-15 nodes depending on the area size.
        3. Return a JSON array of nodes with relative coordinates (x, y from 0 to 100) within the bounding box of the venue.
        
        Return ONLY a JSON array in this format:
        [{"id": 1, "x": 25.5, "y": 30.2, "status": "online"}, ...]
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                status: { type: Type.STRING }
              },
              required: ["id", "x", "y", "status"]
            }
          }
        }
      });

      const result = JSON.parse(response.text || "[]");
      setNodes(result);
    } catch (error) {
      console.error("AI Planning failed", error);
      // Fallback
      const fallbackNodes = Array.from({ length: 10 }).map((_, i) => ({
        id: i,
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60,
        status: 'online' as const
      }));
      setNodes(fallbackNodes);
    } finally {
      setIsAiPlanning(false);
    }
  };

  const nextStep = () => {
    if (creationStep === 3) {
      runAiNodePlanner();
      return;
    }
    setCreationStep(creationStep + 1);
  };

  const prevStep = () => setCreationStep(creationStep - 1);

  const finalizeEvent = () => {
    const newEvent: Event = {
      id: Date.now(),
      name: newEventData.name || 'New Festival',
      location: address || 'Venue Location',
      attendance: newEventData.attendance || '0',
      startDate: newEventData.startDate,
      endDate: newEventData.endDate || newEventData.startDate,
      type: newEventData.type,
      venuePolygon: venuePolygon || undefined,
      nodes: nodes,
      placedElements: placedElements
    };
    setEvents([...events, newEvent]);
    setSelectedEvent(newEvent);
    setIsCreatingEvent(false);
    // Reset form
    setNewEventData({ name: '', startDate: '', endDate: '', attendance: '', type: 'Music Festival' });
    setAddress('');
    setPlacedElements([]);
    setNodes([]);
    setVenuePolygon(null);
    setVenueSize(null);
  };

  const deleteEvent = (id: number, e: MouseEvent) => {
    e.stopPropagation();
    setEvents(events.filter(ev => ev.id !== id));
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Event | null>(null);

  const handleEdit = () => {
    if (selectedEvent) {
      setEditData({ ...selectedEvent });
      setIsEditing(true);
    }
  };

  const saveEdit = () => {
    if (editData) {
      setEvents(events.map(ev => ev.id === editData.id ? editData : ev));
      setSelectedEvent(editData);
      setIsEditing(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full bg-claude-bg text-claude-text font-sans flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-claude-accent rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl border border-black/5 relative z-10 space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-claude-accent text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
              <Radio size={32} />
            </div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-claude-accent">
              Sonic Event Bridge
            </h1>
            <p className="text-claude-muted text-sm font-medium uppercase tracking-[0.15em]">
              Command Center v2.4
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-claude-muted uppercase tracking-widest px-1">Operator ID</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-claude-muted" size={18} />
                <input 
                  type="text" 
                  placeholder="Enter Operator ID"
                  className="w-full pl-12 pr-4 py-4 bg-claude-sidebar rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-claude-accent/20 transition-all font-medium"
                  defaultValue="OP-742-ALPHA"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-claude-muted uppercase tracking-widest px-1">Security Key</label>
              <div className="relative">
                <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-claude-muted" size={18} />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-claude-sidebar rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-claude-accent/20 transition-all font-medium"
                  defaultValue="password"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsLoggedIn(true)}
            className="w-full py-4 bg-claude-accent text-white rounded-2xl font-bold shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 group"
          >
            Authenticate & Initialize <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="text-center">
            <p className="text-[10px] text-claude-muted font-bold uppercase tracking-widest">
              Secure Mesh Protocol Active
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isCreatingEvent) {
    return (
      <div className="min-h-screen w-full bg-claude-bg text-claude-text font-sans flex flex-col">
        {/* Creation Header */}
        <header className="h-16 border-b border-black/5 flex items-center px-8 justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCreatingEvent(false)}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors text-claude-muted"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-serif font-semibold">Initialize New Event Bridge</h1>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div 
                key={step} 
                className={`w-8 h-1 rounded-full transition-all ${
                  step <= creationStep ? 'bg-claude-accent' : 'bg-black/5'
                }`}
              />
            ))}
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
          <div className="max-w-3xl w-full space-y-8">
            <AnimatePresence mode="wait">
              {creationStep === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-serif font-semibold">Schritt 1: Event-Grunddaten</h2>
                    <p className="text-claude-muted">Essential metadata for AI analysis and regulatory protocols.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-claude-muted">Event Name</label>
                      <input 
                        type="text" 
                        value={newEventData.name}
                        onChange={(e) => setNewEventData({...newEventData, name: e.target.value})}
                        placeholder="e.g. Sonic Summer 2026"
                        className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-claude-muted">Start Date</label>
                      <input 
                        type="date" 
                        min={today}
                        value={newEventData.startDate}
                        onChange={(e) => setNewEventData({...newEventData, startDate: e.target.value})}
                        className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-claude-muted">End Date</label>
                      <input 
                        type="date" 
                        min={newEventData.startDate || today}
                        value={newEventData.endDate}
                        onChange={(e) => setNewEventData({...newEventData, endDate: e.target.value})}
                        className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-claude-muted">Expected Attendance</label>
                      <input 
                        type="number" 
                        value={newEventData.attendance}
                        onChange={(e) => setNewEventData({...newEventData, attendance: e.target.value})}
                        placeholder="e.g. 15000"
                        className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-claude-muted">Event Type</label>
                      <select 
                        value={newEventData.type}
                        onChange={(e) => setNewEventData({...newEventData, type: e.target.value})}
                        className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none appearance-none"
                      >
                        <option>Music Festival</option>
                        <option>Conference</option>
                        <option>Sporting Event</option>
                        <option>Public Rally</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={nextStep}
                    disabled={!newEventData.name}
                    className="w-full py-4 bg-claude-accent text-white rounded-2xl font-semibold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    Continue to Venue Mapping
                  </button>
                </motion.div>
              )}

              {creationStep === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-serif font-semibold">Schritt 2: Venue auf Karte</h2>
                    <p className="text-claude-muted">Stilisierte Topographie. AI calculates venue size automatically.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-claude-muted" size={20} />
                        <input 
                          type="text" 
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && geocodeAddress()}
                          placeholder="Search venue address..."
                          className="w-full bg-white border border-black/10 rounded-2xl pl-12 pr-4 py-4 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none shadow-sm"
                        />
                      </div>
                      <button 
                        onClick={geocodeAddress}
                        className="px-6 bg-claude-accent text-white rounded-2xl font-semibold hover:opacity-90 transition-all"
                      >
                        Search
                      </button>
                    </div>
                    <div className="aspect-video bg-claude-sidebar rounded-3xl border border-black/5 relative overflow-hidden shadow-inner z-0">
                      <MapContainer 
                        center={mapCenter} 
                        zoom={16} 
                        style={{ height: '100%', width: '100%' }}
                        ref={(map) => { mapRef.current = map; }}
                      >
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                        />
                        <FeatureGroup>
                          <EditControl
                            position='topright'
                            onCreated={onCreated}
                            draw={{
                              rectangle: false,
                              circle: false,
                              polyline: false,
                              circlemarker: false,
                              marker: false,
                              polygon: {
                                allowIntersection: false,
                                drawError: {
                                  color: '#e1e1e1',
                                  message: '<strong>Error:</strong> Polygon edges cannot cross!'
                                },
                                shapeOptions: {
                                  color: '#1D348A'
                                }
                              }
                            }}
                          />
                        </FeatureGroup>
                        {venuePolygon && (
                          <Polygon 
                            positions={venuePolygon}
                            pathOptions={{ color: '#1D348A', fillOpacity: 0.2, strokeWeight: 2 }}
                          />
                        )}
                      </MapContainer>
                      
                      {venueSize && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-black/5 flex items-center justify-between shadow-xl z-[1000]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                              <Maximize2 size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-claude-muted">Calculated Area</p>
                              <p className="text-lg font-serif font-bold">{venueSize}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-claude-muted">Status</p>
                            <p className="text-xs font-medium text-emerald-600">Area Defined</p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3 items-start">
                      <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800 leading-relaxed">
                        Use the <strong>Polygon Tool</strong> in the top right of the map to draw the exact boundaries of your festival grounds. This area will be used for element placement in the next step.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={prevStep} className="flex-1 py-4 bg-black/5 text-claude-text rounded-2xl font-semibold hover:bg-black/10 transition-all">Back</button>
                    <button onClick={nextStep} disabled={!venuePolygon} className="flex-[2] py-4 bg-claude-accent text-white rounded-2xl font-semibold shadow-lg hover:opacity-90 transition-all disabled:opacity-50">Continue to Element Placement</button>
                  </div>
                </motion.div>
              )}

              {creationStep === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-serif font-semibold">Schritt 3: Elemente per Drag & Drop</h2>
                    <p className="text-claude-muted">Place stages, entrances, and facilities. AI uses this for density analysis.</p>
                  </div>
                  <div className="flex gap-6 h-[500px] relative">
                    {/* Palette */}
                    <div className="w-48 bg-claude-sidebar rounded-3xl border border-black/5 p-4 space-y-3 overflow-y-auto relative z-10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-claude-muted mb-4">Palette</p>
                      {[
                        { type: 'Stage', icon: Radio },
                        { type: 'Entrance', icon: Maximize2 },
                        { type: 'Catering', icon: Activity },
                        { type: 'Sanitary', icon: ShieldAlert },
                        { type: 'Security', icon: ShieldAlert },
                        { type: 'VIP Area', icon: Users },
                        { type: 'First Aid', icon: AlertCircle },
                      ].map((el) => (
                        <button 
                          key={el.type}
                          onClick={() => {
                            setNamingElement({ type: el.type });
                            setTempName('');
                          }}
                          className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-black/5 hover:border-claude-accent/20 transition-all text-sm group"
                        >
                          <el.icon size={16} className="text-claude-muted group-hover:text-claude-accent" />
                          <span>{el.type}</span>
                        </button>
                      ))}
                    </div>
                    {/* Map Area */}
                    <div className="flex-1 bg-white rounded-3xl border border-black/5 relative overflow-hidden shadow-inner">
                      <MapContainer
                        center={mapCenter}
                        zoom={18}
                        dragging={false}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        touchZoom={false}
                        attributionControl={false}
                        style={{ height: '100%', width: '100%', background: 'white' }}
                      >
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        <VenueMask polygon={venuePolygon} />
                        <MapAutoCenter polygon={venuePolygon} padding={[20, 20]} />
                        {venuePolygon && (
                          <Polygon 
                            positions={venuePolygon}
                            pathOptions={{ color: '#1D348A', fillOpacity: 0, weight: 2 }}
                          />
                        )}
                        {placedElements.map((el) => {
                          const pos = getLatLngFromXY(el.x, el.y, venuePolygon!);
                          return (
                            <LeafletMarker
                              key={el.id}
                              position={[pos.lat, pos.lng]}
                              draggable={true}
                              eventHandlers={{
                                dragend: (e) => {
                                  const marker = e.target;
                                  const position = marker.getLatLng();
                                  const { x, y } = getXYFromLatLng(position.lat, position.lng, venuePolygon!);
                                  setPlacedElements(prev => prev.map(p => p.id === el.id ? { ...p, x, y } : p));
                                },
                              }}
                            />
                          );
                        })}
                      </MapContainer>
                      
                      {/* Naming Overlay */}
                      <AnimatePresence>
                        {namingElement && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-8"
                            >
                            <div className="bg-white rounded-3xl border border-black/10 shadow-2xl p-8 max-w-sm w-full space-y-6">
                              <div className="space-y-2">
                                <h3 className="text-xl font-serif font-bold">Name your {namingElement.type}</h3>
                                <p className="text-sm text-claude-muted">Give this element a specific title for the AI planner.</p>
                              </div>
                              <input 
                                autoFocus
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setPlacedElements([...placedElements, { 
                                      id: Date.now(), 
                                      type: namingElement.type, 
                                      name: tempName || namingElement.type, 
                                      x: 50, 
                                      y: 50 
                                    }]);
                                    setNamingElement(null);
                                  }
                                }}
                                placeholder={`e.g. Main ${namingElement.type}`}
                                className="w-full bg-claude-sidebar border border-black/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none"
                              />
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setNamingElement(null)}
                                  className="flex-1 py-3 bg-black/5 rounded-xl font-semibold hover:bg-black/10 transition-all"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={() => {
                                    setPlacedElements([...placedElements, { 
                                      id: Date.now(), 
                                      type: namingElement.type, 
                                      name: tempName || namingElement.type, 
                                      x: 50, 
                                      y: 50 
                                    }]);
                                    setNamingElement(null);
                                  }}
                                  className="flex-1 py-3 bg-claude-accent text-white rounded-xl font-semibold hover:opacity-90 transition-all"
                                >
                                  Add Element
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {placedElements.length === 0 && !namingElement && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-claude-muted text-sm italic gap-2">
                          <MousePointer2 size={24} className="opacity-50" />
                          <span>Click elements in the palette to place them</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={prevStep} className="flex-1 py-4 bg-black/5 text-claude-text rounded-2xl font-semibold hover:bg-black/10 transition-all">Back</button>
                    <button onClick={nextStep} disabled={placedElements.length === 0} className="flex-[2] py-4 bg-claude-accent text-white rounded-2xl font-semibold shadow-lg hover:opacity-90 transition-all disabled:opacity-50">
                      {isAiPlanning ? 'AI Planning in Progress...' : 'Run AI Node Planner'}
                    </button>
                  </div>
                </motion.div>
              )}

              {creationStep === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-serif font-semibold">Schritt 4: KI-Node-Planner</h2>
                    <p className="text-claude-muted">Calculating optimal Seed-Node placement for ≥95% coverage.</p>
                  </div>
                  <div className="aspect-video bg-white rounded-3xl border border-black/5 relative overflow-hidden shadow-xl">
                    <MapContainer
                      center={mapCenter}
                      zoom={18}
                      dragging={false}
                      zoomControl={false}
                      scrollWheelZoom={false}
                      doubleClickZoom={false}
                      touchZoom={false}
                      attributionControl={false}
                      style={{ height: '100%', width: '100%', background: 'white' }}
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      />
                      <VenueMask polygon={venuePolygon} />
                      <MapAutoCenter polygon={venuePolygon} padding={[20, 20]} />
                      {venuePolygon && (
                        <Polygon 
                          positions={venuePolygon}
                          pathOptions={{ color: '#1D348A', fillOpacity: 0, weight: 2 }}
                        />
                      )}
                      {placedElements.map((el) => {
                        const pos = getLatLngFromXY(el.x, el.y, venuePolygon!);
                        return (
                          <LeafletMarker 
                            key={el.id} 
                            position={[pos.lat, pos.lng]}
                          />
                        );
                      })}
                      {nodes.map((node) => {
                        const pos = getLatLngFromXY(node.x, node.y, venuePolygon!);
                        return (
                          <LeafletMarker 
                            key={node.id} 
                            position={[pos.lat, pos.lng]}
                          />
                        );
                      })}
                    </MapContainer>
                    {isAiPlanning && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50">
                        <div className="w-12 h-12 border-4 border-claude-accent border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-bold text-claude-accent animate-pulse">Gemini AI is planning your network...</p>
                      </div>
                    )}
                    <div className="absolute top-6 right-6 space-y-2">
                      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-black/5 shadow-lg space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-claude-muted">Coverage Analysis</p>
                        <p className="text-2xl font-serif font-bold text-emerald-600">98.2%</p>
                        <p className="text-[10px] text-claude-muted">Optimal coverage achieved</p>
                      </div>
                      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-black/5 shadow-lg space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-claude-muted">Nodes Required</p>
                        <p className="text-2xl font-serif font-bold text-claude-text">{nodes.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={prevStep} className="flex-1 py-4 bg-black/5 text-claude-text rounded-2xl font-semibold hover:bg-black/10 transition-all">Back</button>
                    <button onClick={finalizeEvent} className="flex-[2] py-4 bg-claude-accent text-white rounded-2xl font-semibold shadow-lg hover:opacity-90 transition-all">Finalize & Go-Live</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen w-full bg-claude-bg text-claude-text font-sans flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full space-y-12"
        >
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-serif font-bold tracking-tight text-claude-accent">
              Sonic Event Bridge
            </h1>
            <p className="text-claude-muted text-lg max-w-lg mx-auto">
              Mission control for crowd management. Select an active operation or initialize a new event bridge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const status = getEventStatus(event.startDate, event.endDate);
              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4, shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  onClick={() => setSelectedEvent(event)}
                  className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm text-left flex flex-col justify-between h-48 transition-all group relative cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        status === 'Live' ? 'bg-emerald-100 text-emerald-700' : 
                        status === 'Scheduled' ? 'bg-blue-100 text-blue-700' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {status}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => deleteEvent(event.id, e)}
                          className="p-1.5 text-claude-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X size={14} />
                        </button>
                        <ChevronRight size={16} className="text-claude-muted group-hover:text-claude-accent transition-colors" />
                      </div>
                    </div>
                    <h3 className="text-xl font-serif font-semibold leading-tight">{event.name}</h3>
                  </div>
                  <div className="flex items-center justify-between text-xs text-claude-muted">
                    <span className="flex items-center gap-1"><MapIcon size={12} /> {event.location}</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {event.attendance}</span>
                  </div>
                </motion.div>
              );
            })}

            <button 
              onClick={handleCreateEvent}
              className="p-6 rounded-3xl border-2 border-dashed border-black/5 hover:border-claude-accent/20 hover:bg-claude-accent/[0.02] transition-all flex flex-col items-center justify-center text-center space-y-3 group h-48"
            >
              <div className="p-3 bg-black/5 rounded-full text-claude-muted group-hover:text-claude-accent transition-colors">
                <Plus size={24} />
              </div>
              <span className="text-sm font-semibold text-claude-muted group-hover:text-claude-text transition-colors">
                Initialize New Event
              </span>
            </button>
          </div>

          <div className="pt-8 border-t border-black/5 flex items-center justify-between text-[11px] text-claude-muted uppercase tracking-widest font-semibold">
            <span>v2.4.0 Stable Build</span>
            <div className="flex items-center gap-4">
              <button className="hover:text-claude-text transition-colors">Documentation</button>
              <button className="hover:text-claude-text transition-colors">Support</button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-claude-bg text-claude-text font-sans">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="h-full bg-claude-sidebar border-r border-black/5 flex flex-col z-20"
          >
            <div className="p-6 flex flex-col gap-1">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-xl font-serif font-bold tracking-tight text-claude-accent hover:opacity-80 transition-opacity text-left"
              >
                Sonic Event Bridge
              </button>
              <p className="text-[10px] text-claude-muted uppercase tracking-[0.2em] font-semibold">
                Organizer Command Center
              </p>
            </div>

            <div className="p-4">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-claude-accent text-white rounded-xl text-sm font-medium shadow-sm hover:opacity-90 transition-all w-full justify-center">
                <Radio size={16} />
                <span>Emergency Broadcast</span>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {[
                { id: 'live', label: 'Live Map', icon: MapIcon },
                { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
                { id: 'network', label: 'Network Stats', icon: Activity },
                { id: 'crowd', label: 'Crowd Analytics', icon: Users },
                { id: 'safety', label: 'Safety & Alerts', icon: ShieldAlert },
                { id: 'nodes', label: 'Node Management', icon: Radio },
                { id: 'reports', label: 'Reports', icon: FileText },
              ].map((page) => (
                <button
                  key={page.id}
                  onClick={() => setDashboardPage(page.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    dashboardPage === page.id 
                      ? 'bg-claude-accent/10 text-claude-accent font-semibold shadow-sm' 
                      : 'text-claude-muted hover:bg-black/5 hover:text-claude-text'
                  }`}
                >
                  <page.icon size={18} />
                  <span>{page.label}</span>
                </button>
              ))}
              
              <div className="pt-4 mt-4 border-t border-black/5">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-claude-muted hover:bg-black/5 hover:text-claude-text transition-all"
                >
                  <ArrowLeft size={18} />
                  <span>Switch Event</span>
                </button>
              </div>
            </nav>

            <div className="p-4 border-t border-black/5">
              <div className="px-3 py-3 bg-white/50 rounded-xl border border-black/5 flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-full bg-claude-accent/10 flex items-center justify-center text-claude-accent font-bold text-xs">
                  VN
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">Vinzent Nagell</p>
                  <p className="text-[10px] text-claude-muted truncate">Safety Lead</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center px-6 justify-between border-b border-black/5 bg-white/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors text-claude-muted"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="h-4 w-[1px] bg-black/10 mx-2" />
            <h1 className="text-lg font-serif font-semibold text-claude-text">
              {selectedEvent.name}
            </h1>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
              getEventStatus(selectedEvent.startDate, selectedEvent.endDate) === 'Live' ? 'bg-emerald-100 text-emerald-700' : 
              getEventStatus(selectedEvent.startDate, selectedEvent.endDate) === 'Scheduled' ? 'bg-blue-100 text-blue-700' : 
              'bg-gray-100 text-gray-600'
            }`}>
              {getEventStatus(selectedEvent.startDate, selectedEvent.endDate)}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-claude-muted hover:bg-black/5 rounded-lg relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {dashboardPage === 'live' ? (
              <div className="space-y-6">
                {/* Top Metrics */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Active Nodes', value: `${nodes.length || 24}/${nodes.length || 24}`, icon: Radio, trend: '100%', color: 'emerald' },
                    { label: 'Stability', value: '99.8%', icon: Activity, trend: '+0.2%', color: 'blue' },
                    { label: 'Mesh Coverage', value: '94.2%', icon: Layers, trend: 'Optimal', color: 'indigo' },
                    { label: 'Avg. Latency', value: '12ms', icon: MousePointer2, trend: '-2ms', color: 'amber' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-xl ${
                          stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                          stat.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                          stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          <stat.icon size={18} />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{stat.trend}</span>
                      </div>
                      <div>
                        <p className="text-xs text-claude-muted font-medium">{stat.label}</p>
                        <p className="text-2xl font-serif font-bold">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Main Content Area */}
                <div className="flex gap-6 h-[600px]">
                  {/* Live Map with Heatmap */}
                  <div className="flex-1 bg-white rounded-[40px] border border-black/5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
                      <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl border border-black/5 shadow-lg flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-xs font-bold uppercase tracking-wider">Live Feed</span>
                        </div>
                        <div className="h-4 w-px bg-black/10" />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-claude-muted font-bold">DENSITY:</span>
                          <div className="flex gap-1">
                            <div className="w-3 h-1.5 bg-blue-500 rounded-full" />
                            <div className="w-3 h-1.5 bg-orange-500 rounded-full" />
                            <div className="w-3 h-1.5 bg-red-500 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute inset-0 z-0">
                      <MapContainer
                        center={mapCenter}
                        zoom={18}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                        />
                        <MapAutoCenter polygon={selectedEvent?.venuePolygon || null} />
                        {selectedEvent?.venuePolygon && (
                          <Polygon 
                            positions={selectedEvent.venuePolygon}
                            pathOptions={{ color: '#1D348A', fillOpacity: 0.05, weight: 1 }}
                          />
                        )}
                        
                        {/* Coverage Gaps */}
                        {coverageGaps.map(gap => {
                          const pos = getLatLngFromXY(gap.x, gap.y, selectedEvent?.venuePolygon || []);
                          return (
                            <Polygon
                              key={gap.id}
                              positions={[
                                [pos.lat - 0.0001, pos.lng - 0.0001],
                                [pos.lat + 0.0001, pos.lng - 0.0001],
                                [pos.lat + 0.0001, pos.lng + 0.0001],
                                [pos.lat - 0.0001, pos.lng + 0.0001]
                              ]}
                              pathOptions={{ color: '#ef4444', fillOpacity: 0.3, weight: 1 }}
                            />
                          );
                        })}

                        {/* Heatmap Layer */}
                        {selectedEvent?.venuePolygon && (
                          <HeatmapLayer 
                            points={crowdBlobs.map(blob => {
                              const pos = getLatLngFromXY(blob.x, blob.y, selectedEvent.venuePolygon!);
                              const intensityValue = blob.intensity === 'critical' ? 1.0 : blob.intensity === 'high' ? 0.8 : blob.intensity === 'med' ? 0.5 : 0.2;
                              return [pos.lat, pos.lng, intensityValue] as [number, number, number];
                            })} 
                          />
                        )}

                        {/* Nodes */}
                        {nodes.map((node) => {
                          const pos = getLatLngFromXY(node.x, node.y, selectedEvent?.venuePolygon || []);
                          return (
                            <LeafletMarker 
                              key={node.id} 
                              position={[pos.lat, pos.lng]}
                            />
                          );
                        })}
                      </MapContainer>
                    </div>
                  </div>

                  {/* Right Panel */}
                  <div className="w-80 space-y-4 flex flex-col">
                    {/* Quick Broadcast */}
                    <div className="bg-claude-accent text-white p-6 rounded-[32px] shadow-lg space-y-4 relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="p-2 bg-white/20 rounded-xl">
                          <Megaphone size={20} />
                        </div>
                        <h4 className="font-bold">Quick Broadcast</h4>
                      </div>
                      <p className="text-xs text-white/70 relative z-10">Send emergency alerts to all connected mesh nodes instantly.</p>
                      <button className="w-full py-3 bg-white text-claude-accent rounded-xl font-bold hover:bg-white/90 transition-all flex items-center justify-center gap-2 relative z-10 active:scale-95">
                        <Send size={16} />
                        Broadcast Alert
                      </button>
                    </div>

                    {/* Node Overview */}
                    <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-claude-muted">Critical Alerts</h4>
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        </div>
                        <span className="text-[10px] font-bold text-red-600">{coverageGaps.length} GAPS FOUND</span>
                      </div>
                      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {coverageGaps.map((gap) => (
                          <div key={gap.id} className="p-3 bg-red-50 rounded-2xl border border-red-100 space-y-2">
                            <div className="flex items-center gap-2">
                              <ShieldAlert size={14} className="text-red-600" />
                              <p className="text-[10px] font-bold text-red-800 uppercase tracking-tight">{gap.reason}</p>
                            </div>
                            <p className="text-[9px] text-red-700 font-medium">Low signal density detected. Placement of a bridge node recommended to maintain mesh integrity.</p>
                            <button className="w-full py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-red-700 transition-colors">
                              Deploy AI Planner
                            </button>
                          </div>
                        ))}
                        <div className="h-px bg-black/5 my-2" />
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Active Nodes</h4>
                        </div>
                        {(nodes.length > 0 ? nodes : Array.from({length: 8}).map((_, i) => ({id: i+100, x: 0, y: 0}))).map((node) => (
                          <div key={node.id} className="flex items-center justify-between p-3 bg-claude-sidebar rounded-2xl border border-black/5 hover:border-claude-accent/20 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                              <div>
                                <p className="text-[10px] font-bold group-hover:text-claude-accent transition-colors">NODE #{node.id}</p>
                                <p className="text-[8px] text-claude-muted uppercase font-semibold">Seed Node • {Math.floor(Math.random() * 20 + 80)}% Bat.</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-mono font-bold">-{Math.floor(Math.random() * 20 + 30)} dBm</p>
                              <p className="text-[8px] text-emerald-600 font-bold uppercase">Stable</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : dashboardPage === 'broadcast' ? (
                <BroadcastPage nodesCount={nodes.length || 24} />
              ) : (
                <div className="flex items-center justify-center h-[600px] bg-white rounded-[40px] border border-black/5 text-claude-muted italic">
                  Page "{dashboardPage}" is under construction.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
}
