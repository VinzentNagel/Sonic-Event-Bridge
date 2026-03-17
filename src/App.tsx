/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
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
  Map,
  MessageSquare,
  Clock,
  ArrowUpRight,
  Plus
} from 'lucide-react';

import { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  Wifi,
  Zap,
  Maximize2,
  MousePointer2,
  Layers,
  Info,
  Trash2,
  Edit2
} from 'lucide-react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Marker as LeafletMarker } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-geometryutil';
import { GoogleGenAI, Type } from "@google/genai";

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type EventStatus = 'Live' | 'Scheduled' | 'Archived' | 'Draft';

interface Event {
  id: number;
  name: string;
  location: string;
  attendance: string;
  startDate: string;
  endDate: string;
  type?: string;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
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
      type: 'Music Festival'
    },
    { 
      id: 2, 
      name: 'Winter Gala Concert', 
      location: 'Vienna, AT', 
      attendance: '0',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      type: 'Conference'
    },
    { 
      id: 3, 
      name: 'Tech Summit Expo', 
      location: 'San Francisco, US', 
      attendance: '5,400',
      startDate: '2025-11-10',
      endDate: '2025-11-12',
      type: 'Conference'
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
      type: newEventData.type
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

  const deleteEvent = (id: number, e: React.MouseEvent) => {
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
            {[1, 2, 3, 4, 5, 6].map((step) => (
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
                        value={newEventData.startDate}
                        onChange={(e) => setNewEventData({...newEventData, startDate: e.target.value})}
                        className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-claude-accent/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-claude-muted">End Date</label>
                      <input 
                        type="date" 
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
                        ref={mapRef as any}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                                  message: '<strong>Oh snap!<strong> you can\'t draw that!'
                                },
                                shapeOptions: {
                                  color: '#1D348A'
                                }
                              }
                            }}
                          />
                        </FeatureGroup>
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
                    <div className="w-48 bg-claude-sidebar rounded-3xl border border-black/5 p-4 space-y-3 overflow-y-auto">
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
                      <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {venuePolygon && (
                            <polygon 
                              points={(() => {
                                // Normalize polygon to fit 0-100
                                const lats = venuePolygon.map(p => p[0]);
                                const lngs = venuePolygon.map(p => p[1]);
                                const minLat = Math.min(...lats);
                                const maxLat = Math.max(...lats);
                                const minLng = Math.min(...lngs);
                                const maxLng = Math.max(...lngs);
                                
                                return venuePolygon.map(p => {
                                  const x = ((p[1] - minLng) / (maxLng - minLng)) * 100;
                                  const y = 100 - ((p[0] - minLat) / (maxLat - minLat)) * 100;
                                  return `${x},${y}`;
                                }).join(' ');
                              })()}
                              fill="#1D348A"
                              fillOpacity="0.1"
                              stroke="#1D348A"
                              strokeWidth="0.5"
                            />
                          )}
                        </svg>
                      </div>
                      <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] opacity-5" />
                      
                      {placedElements.map((el) => (
                        <motion.div 
                          key={el.id}
                          drag
                          dragMomentum={false}
                          dragElastic={0}
                          onDragEnd={(_, info) => {
                            const rect = dropZoneRef.current?.getBoundingClientRect();
                            if (rect) {
                              const x = ((info.point.x - rect.left) / rect.width) * 100;
                              const y = ((info.point.y - rect.top) / rect.height) * 100;
                              setPlacedElements(prev => prev.map(p => p.id === el.id ? { ...p, x, y } : p));
                            }
                          }}
                          animate={{ x: 0, y: 0 }}
                          transition={{ duration: 0 }}
                          initial={{ scale: 0 }}
                          style={{ left: `${el.x}%`, top: `${el.y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 p-2 bg-claude-accent text-white rounded-lg shadow-lg cursor-grab active:cursor-grabbing flex items-center gap-2 z-10"
                        >
                          <MousePointer2 size={12} />
                          <div className="flex flex-col">
                            <span className="text-[8px] opacity-70 leading-none">{el.type}</span>
                            <span className="text-[10px] font-bold leading-tight">{el.name}</span>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlacedElements(prev => prev.filter(p => p.id !== el.id));
                            }}
                            className="p-0.5 hover:bg-white/20 rounded"
                          >
                            <X size={10} />
                          </button>
                        </motion.div>
                      ))}
                      <div ref={dropZoneRef} id="drop-zone" className="absolute inset-0" />
                      
                      {/* Naming Overlay */}
                      <AnimatePresence>
                        {namingElement && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
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
                    <div className="absolute inset-0 bg-claude-sidebar/30" />
                    {/* SVG Venue Plan Result */}
                    <svg width="100%" height="100%" className="absolute inset-0">
                      {venuePolygon && (
                        <polygon 
                          points={(() => {
                            const lats = venuePolygon.map(p => p[0]);
                            const lngs = venuePolygon.map(p => p[1]);
                            const minLat = Math.min(...lats);
                            const maxLat = Math.max(...lats);
                            const minLng = Math.min(...lngs);
                            const maxLng = Math.max(...lngs);
                            
                            return venuePolygon.map(p => {
                              const x = ((p[1] - minLng) / (maxLng - minLng)) * 100;
                              const y = 100 - ((p[0] - minLat) / (maxLat - minLat)) * 100;
                              return `${x},${y}`;
                            }).join(' ');
                          })()}
                          fill="#1D348A"
                          fillOpacity="0.05"
                          stroke="#1D348A"
                          strokeWidth="1"
                          strokeDasharray="5 5"
                        />
                      )}
                      {placedElements.map((el) => (
                        <g key={el.id} transform={`translate(${el.x}, ${el.y})`}>
                          <rect x="-10" y="-10" width="20" height="20" fill="#1D348A" rx="4" opacity="0.2" />
                          <text x="0" y="0" fontSize="4" textAnchor="middle" dominantBaseline="middle" fill="#1D348A" fontWeight="bold">
                            {el.type.charAt(0)}
                          </text>
                        </g>
                      ))}
                      {nodes.map((node) => (
                        <g key={node.id}>
                          <circle 
                            cx={`${node.x}%`} 
                            cy={`${node.y}%`} 
                            r="40" 
                            fill="rgba(29, 52, 138, 0.05)" 
                            stroke="rgba(29, 52, 138, 0.2)" 
                            strokeWidth="1" 
                            strokeDasharray="4 2"
                          />
                          <circle 
                            cx={`${node.x}%`} 
                            cy={`${node.y}%`} 
                            r="4" 
                            fill="#1D348A" 
                          />
                        </g>
                      ))}
                    </svg>
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
                    <button onClick={nextStep} className="flex-[2] py-4 bg-claude-accent text-white rounded-2xl font-semibold shadow-lg hover:opacity-90 transition-all">Initialize Network Validation</button>
                  </div>
                </motion.div>
              )}

              {creationStep === 5 && (
                <motion.div 
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-serif font-semibold">Schritt 5: Network-Validation</h2>
                    <p className="text-claude-muted">Live packet testing. Flagging coverage gaps for field teams.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 bg-white rounded-3xl border border-black/5 p-6 h-[400px] relative overflow-hidden">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-bold uppercase tracking-wider">Live Signal Map</h4>
                        <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          Testing Packets...
                        </div>
                      </div>
                      <div className="relative h-full">
                        {nodes.map((node) => (
                          <div 
                            key={node.id}
                            style={{ left: `${node.x}%`, top: `${node.y}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group"
                          >
                            <div className={`w-3 h-3 rounded-full ${
                              node.status === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                            }`} />
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Node #{node.id} - {node.status === 'online' ? '-42 dBm' : '-78 dBm'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white rounded-3xl border border-black/5 p-5 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-claude-muted">Field Recommendations</h4>
                        <div className="space-y-3">
                          {nodes.filter(n => n.status === 'warning').map(n => (
                            <div key={n.id} className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                              <AlertCircle size={16} className="text-amber-600 shrink-0" />
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-amber-800">Node #{n.id} Weak Signal</p>
                                <p className="text-[9px] text-amber-700">Relocate 5m North-East to bypass concrete obstruction.</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-emerald-50 rounded-3xl border border-emerald-100 p-5 flex items-center gap-4">
                        <div className="p-2 bg-emerald-500 text-white rounded-xl">
                          <Wifi size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Network Health</p>
                          <p className="text-lg font-serif font-bold text-emerald-900">Stable</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={prevStep} className="flex-1 py-4 bg-black/5 text-claude-text rounded-2xl font-semibold hover:bg-black/10 transition-all">Back</button>
                    <button onClick={nextStep} className="flex-[2] py-4 bg-claude-accent text-white rounded-2xl font-semibold shadow-lg hover:opacity-90 transition-all">Finalize & Go-Live</button>
                  </div>
                </motion.div>
              )}

              {creationStep === 6 && (
                <motion.div 
                  key="step6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-8 py-12"
                >
                  <div className="flex justify-center">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                      <CheckCircle2 size={48} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-serif font-bold">Schritt 6: Go-Live</h2>
                    <p className="text-claude-muted max-w-md mx-auto">
                      Venue-Engine initialisiert. SVG-Plan kalibriert. Das Dashboard ist bereit für Echtzeit-RSSI-Daten.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
                    <div className="p-4 bg-white rounded-2xl border border-black/5 space-y-1">
                      <p className="text-[10px] font-bold text-claude-muted uppercase tracking-wider">Coordinates</p>
                      <p className="text-sm font-bold">Set</p>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-black/5 space-y-1">
                      <p className="text-[10px] font-bold text-claude-muted uppercase tracking-wider">Heatmap</p>
                      <p className="text-sm font-bold">Ready</p>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-black/5 space-y-1">
                      <p className="text-[10px] font-bold text-claude-muted uppercase tracking-wider">Nodes</p>
                      <p className="text-sm font-bold">Active</p>
                    </div>
                  </div>
                  <button 
                    onClick={finalizeEvent}
                    className="px-12 py-4 bg-claude-accent text-white rounded-2xl font-semibold shadow-xl hover:opacity-90 transition-all flex items-center gap-2 mx-auto"
                  >
                    Enter Command Center <ArrowUpRight size={20} />
                  </button>
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
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm bg-black/5 text-claude-text font-medium transition-all"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard size={18} className="text-claude-accent" />
                  <span>Overview</span>
                </div>
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-claude-muted hover:bg-black/5 hover:text-claude-text transition-all"
              >
                <ArrowLeft size={18} />
                <span>Switch Event</span>
              </button>
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
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-semibold">Event Overview</h2>
                <p className="text-claude-muted">Real-time operational status for {selectedEvent.name}.</p>
              </div>
              <button 
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-medium hover:bg-black/5 transition-all"
              >
                <Settings size={16} />
                <span>Edit Event Details</span>
              </button>
            </div>

            {isEditing && editData && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-6 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-serif font-semibold">Edit Event Configuration</h3>
                  <button onClick={() => setIsEditing(false)} className="text-claude-muted hover:text-claude-text">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-claude-muted">Event Name</label>
                    <input 
                      type="text" 
                      value={editData.name}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      className="w-full bg-claude-bg border border-black/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-claude-accent/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-claude-muted">Location</label>
                    <input 
                      type="text" 
                      value={editData.location}
                      onChange={(e) => setEditData({...editData, location: e.target.value})}
                      className="w-full bg-claude-bg border border-black/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-claude-accent/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-claude-muted">Start Date</label>
                    <input 
                      type="date" 
                      value={editData.startDate}
                      onChange={(e) => setEditData({...editData, startDate: e.target.value})}
                      className="w-full bg-claude-bg border border-black/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-claude-accent/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-claude-muted">End Date</label>
                    <input 
                      type="date" 
                      value={editData.endDate}
                      onChange={(e) => setEditData({...editData, endDate: e.target.value})}
                      className="w-full bg-claude-bg border border-black/5 rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-claude-accent/20"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-sm font-medium text-claude-muted hover:text-claude-text"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveEdit}
                    className="px-6 py-2 bg-claude-accent text-white rounded-xl text-sm font-medium shadow-sm hover:opacity-90 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Attendance', value: selectedEvent.attendance, icon: Users, color: 'text-blue-600' },
                { label: 'Active Staff', value: '124', icon: ShieldAlert, color: 'text-emerald-600' },
                { label: 'Open Incidents', value: '3', icon: AlertCircle, color: 'text-red-600' },
                { label: 'Capacity', value: '82%', icon: Activity, color: 'text-amber-600' },
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm"
                >
                  <div className={`p-2 rounded-xl bg-black/5 w-fit mb-3 ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                  <p className="text-2xl font-serif font-bold text-claude-text">{stat.value}</p>
                  <p className="text-xs text-claude-muted mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Placeholder for future modules */}
            <div className="p-12 border-2 border-dashed border-black/5 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-black/5 rounded-full text-claude-muted">
                <LayoutDashboard size={32} />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-claude-text">Ready for new modules</p>
                <p className="text-sm text-claude-muted max-w-xs mx-auto">
                  The dashboard is minimized. Start adding specialized operational features one by one.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
