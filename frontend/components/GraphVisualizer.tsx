"use client";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ZoomIn, ZoomOut, RefreshCw, X, Info } from "lucide-react";

interface Node {
  id: number;
  label: string;
  type: string;
  description: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Edge {
  id: number;
  source: number; // source node id
  target: number; // target node id
  type: string;
  description: string;
}

interface GraphVisualizerProps {
  data: {
    nodes: Node[];
    edges: Edge[];
  };
  onRefresh?: () => void;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  Person: { bg: "#ec4899", border: "#db2777", glow: "rgba(236, 72, 153, 0.4)" }, // Pink
  Organization: { bg: "#06b6d4", border: "#0891b2", glow: "rgba(6, 182, 212, 0.4)" }, // Cyan
  Location: { bg: "#10b981", border: "#059669", glow: "rgba(16, 185, 129, 0.4)" }, // Emerald
  Technology: { bg: "#8b5cf6", border: "#7c3aed", glow: "rgba(139, 92, 246, 0.4)" }, // Purple
  Concept: { bg: "#3b82f6", border: "#2563eb", glow: "rgba(59, 130, 246, 0.4)" }, // Blue
  Event: { bg: "#f59e0b", border: "#d97706", glow: "rgba(245, 158, 11, 0.4)" }, // Amber
  Default: { bg: "#6b7280", border: "#4b5563", glow: "rgba(107, 114, 128, 0.4)" }, // Gray
};

export default function GraphVisualizer({ data, onRefresh }: GraphVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation state
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Transform state (Pan & Zoom)
  const transform = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef<Node | null>(null);

  // Initialize nodes with positions
  useEffect(() => {
    if (!data.nodes || data.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 500;

    // Deep copy data and assign initial layout positions in a circle/random spread
    const initialNodes = data.nodes.map((node, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.3 * Math.random() + 50;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    setNodes(initialNodes);
    setEdges(data.edges);
    setSelectedNode(null);
    setHoveredNode(null);

    // Reset view transform to center
    transform.current = { x: 0, y: 0, scale: 1 };
  }, [data]);

  // Run Physics Simulation & Canvas Rendering Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Simulation Parameters
    const repulsionStrength = 1500; // Force repelling nodes
    const linkStrength = 0.05; // Force pulling connected nodes
    const gravity = 0.015; // Pull towards center
    const damping = 0.82; // Friction to slow down movement

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const runSimulation = () => {
      // 1. Calculate Repulsion (between all nodes)
      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        if (nodeA === draggedNodeRef.current) continue; // Don't apply forces to node being dragged

        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const nodeB = nodes[j];

          const dx = nodeA.x! - nodeB.x!;
          const dy = nodeA.y! - nodeB.y!;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) dist = 0.1;

          if (dist < 400) {
            // Apply Coulomb force
            const force = repulsionStrength / (dist * dist);
            nodeA.vx! += (dx / dist) * force;
            nodeA.vy! += (dy / dist) * force;
          }
        }
      }

      // 2. Calculate Attraction (Hooke's law between connected nodes)
      edges.forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const dx = targetNode.x! - sourceNode.x!;
          const dy = targetNode.y! - sourceNode.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

          // Pull together
          const force = dist * linkStrength;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (sourceNode !== draggedNodeRef.current) {
            sourceNode.vx! += fx;
            sourceNode.vy! += fy;
          }
          if (targetNode !== draggedNodeRef.current) {
            targetNode.vx! -= fx;
            targetNode.vy! -= fy;
          }
        }
      });

      // 3. Apply gravity to pull nodes back to center & update positions
      nodes.forEach((node) => {
        if (node === draggedNodeRef.current) return;

        // Pull to center
        const dx = centerX - node.x!;
        const dy = centerY - node.y!;
        node.vx! += dx * gravity;
        node.vy! += dy * gravity;

        // Apply velocities & damping
        node.x! += node.vx!;
        node.y! += node.vy!;
        node.vx! *= damping;
        node.vy! *= damping;
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Save state and apply Pan/Zoom translations
      ctx.save();
      ctx.translate(transform.current.x, transform.current.y);
      ctx.scale(transform.current.scale, transform.current.scale);

      // Draw Edges (Relationships)
      edges.forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const isHighlighted = hoveredNode 
            ? (hoveredNode.id === sourceNode.id || hoveredNode.id === targetNode.id)
            : selectedNode 
            ? (selectedNode.id === sourceNode.id || selectedNode.id === targetNode.id)
            : true;

          ctx.beginPath();
          ctx.moveTo(sourceNode.x!, sourceNode.y!);
          ctx.lineTo(targetNode.x!, targetNode.y!);
          
          ctx.strokeStyle = isHighlighted ? "rgba(156, 163, 175, 0.6)" : "rgba(229, 231, 235, 0.15)";
          ctx.lineWidth = isHighlighted ? 1.8 : 0.8;
          ctx.stroke();

          // Draw relationship type label along the edge (only if high quality/highlighted)
          if (isHighlighted && transform.current.scale > 0.6) {
            const midX = (sourceNode.x! + targetNode.x!) / 2;
            const midY = (sourceNode.y! + targetNode.y!) / 2;
            ctx.save();
            ctx.fillStyle = "rgba(107, 114, 128, 0.85)";
            ctx.font = "8px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(edge.type, midX, midY - 4);
            ctx.restore();
          }
        }
      });

      // Draw Nodes (Entities)
      nodes.forEach((node) => {
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;
        const isSearched = searchQuery ? node.label.toLowerCase().includes(searchQuery.toLowerCase()) : false;
        
        const colors = TYPE_COLORS[node.type] || TYPE_COLORS.Default;
        const radius = isHovered || isSelected ? 15 : 11;

        // Apply a cool glowing shadow for hovered, selected, or searched nodes
        if (isHovered || isSelected || isSearched) {
          ctx.save();
          ctx.shadowColor = colors.border;
          ctx.shadowBlur = isSearched ? 18 : 12;
        }

        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.bg;
        ctx.fill();

        if (isHovered || isSelected || isSearched) {
          ctx.restore();
        }

        // Draw border ring
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? "#ffffff" : colors.border;
        ctx.lineWidth = isSelected ? 3.0 : 1.5;
        ctx.stroke();

        // Draw labels (only if scale is readable or hovered/selected)
        const showLabel = transform.current.scale > 0.45 || isHovered || isSelected || isSearched;
        if (showLabel) {
          ctx.save();
          ctx.font = isSelected ? "bold 11px sans-serif" : "10px sans-serif";
          ctx.fillStyle = isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.85)";
          
          // Draw subtle background rectangle for readability
          const labelWidth = ctx.measureText(node.label).width;
          ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
          ctx.fillRect(node.x! - labelWidth / 2 - 4, node.y! - radius - 16, labelWidth + 8, 14);

          // Draw text
          ctx.fillStyle = isSelected ? "#38bdf8" : isSearched ? "#facc15" : "rgba(255, 255, 255, 0.9)";
          ctx.textAlign = "center";
          ctx.fillText(node.label, node.x!, node.y! - radius - 6);
          ctx.restore();
        }
      });

      ctx.restore();
    };

    const loop = () => {
      runSimulation();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, edges, hoveredNode, selectedNode, searchQuery]);

  // Handle Resize of Canvas
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight || 500;
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Find node under mouse coords
  const getNodeAtCoords = (clientX: number, clientY: number): Node | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert screen coordinates back to graph coordinates (accounting for zoom/pan)
    const graphX = (x - transform.current.x) / transform.current.scale;
    const graphY = (y - transform.current.y) / transform.current.scale;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = node.x! - graphX;
      const dy = node.y! - graphY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 20) {
        return node;
      }
    }
    return null;
  };

  // Pointer Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const node = getNodeAtCoords(e.clientX, e.clientY);

    if (node) {
      draggedNodeRef.current = node;
    } else {
      isDraggingCanvas.current = true;
      dragStart.current = { x: e.clientX - transform.current.x, y: e.clientY - transform.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggedNodeRef.current) {
      // Dragging a Node
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update node's position directly matching mouse in graph space
      draggedNodeRef.current.x = (x - transform.current.x) / transform.current.scale;
      draggedNodeRef.current.y = (y - transform.current.y) / transform.current.scale;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    } else if (isDraggingCanvas.current) {
      // Panning Canvas
      transform.current = {
        ...transform.current,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      };
    } else {
      // Hover Check
      const node = getNodeAtCoords(e.clientX, e.clientY);
      setHoveredNode(node);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggedNodeRef.current) {
      // Trigger select on click (if barely moved)
      setSelectedNode(draggedNodeRef.current);
      draggedNodeRef.current = null;
    }

    isDraggingCanvas.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomIntensity = 0.1;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom math centered around cursor
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(wheel * zoomIntensity);

    const nextScale = Math.min(Math.max(transform.current.scale * zoomFactor, 0.15), 5);

    // Shift pan to keep cursor point fixed
    const graphMouseX = (mouseX - transform.current.x) / transform.current.scale;
    const graphMouseY = (mouseY - transform.current.y) / transform.current.scale;

    transform.current = {
      scale: nextScale,
      x: mouseX - graphMouseX * nextScale,
      y: mouseY - graphMouseY * nextScale,
    };
  };

  // Zoom Button Controls
  const adjustZoom = (zoomIn: boolean) => {
    const factor = zoomIn ? 1.25 : 0.8;
    const nextScale = Math.min(Math.max(transform.current.scale * factor, 0.15), 5);
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Zoom centered on canvas viewport center
    const graphCenterX = (width / 2 - transform.current.x) / transform.current.scale;
    const graphCenterY = (height / 2 - transform.current.y) / transform.current.scale;

    transform.current = {
      scale: nextScale,
      x: width / 2 - graphCenterX * nextScale,
      y: height / 2 - graphCenterY * nextScale,
    };
  };

  const resetView = () => {
    transform.current = { x: 0, y: 0, scale: 1 };
    
    // Re-jitter layout
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 500;
    
    setNodes((prevNodes) =>
      prevNodes.map((node, i) => {
        const angle = (i / prevNodes.length) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.3 * Math.random() + 50;
        return {
          ...node,
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
        };
      })
    );
  };

  const handleSearchSelect = (node: Node) => {
    setSelectedNode(node);
    
    // Center view on this node
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;

    transform.current = {
      scale: 1.5,
      x: w / 2 - node.x! * 1.5,
      y: h / 2 - node.y! * 1.5,
    };
  };

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-4 h-[600px] bg-slate-950/40 rounded-xl border border-slate-800/80 p-2 overflow-hidden backdrop-blur-md">
      
      {/* Visualizer Area */}
      <div ref={containerRef} className="relative w-full h-full rounded-lg bg-slate-950/60 overflow-hidden cursor-grab active:cursor-grabbing border border-slate-900">
        
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="absolute inset-0 block"
        />

        {/* Floating Controls */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur border border-slate-800 rounded-md p-1 z-10 shadow-lg">
          <Button size="icon" variant="ghost" className="size-8 text-slate-400 hover:text-slate-200" onClick={() => adjustZoom(true)}>
            <ZoomIn className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8 text-slate-400 hover:text-slate-200" onClick={() => adjustZoom(false)}>
            <ZoomOut className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8 text-slate-400 hover:text-slate-200" onClick={resetView} title="Reset view position">
            <RefreshCw className="size-3.5" />
          </Button>
          {onRefresh && (
            <Button size="icon" variant="ghost" className="size-8 text-slate-400 hover:text-slate-200" onClick={onRefresh} title="Fetch updated data">
              <RefreshCw className="size-3.5 animate-spin-slow" />
            </Button>
          )}
        </div>

        {/* Legend */}
        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm border border-slate-800/70 rounded-lg p-2.5 z-10 space-y-1.5 shadow-md">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ประเภทเอนทิตี</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-slate-300">
            {Object.entries(TYPE_COLORS).map(([type, colors]) => {
              if (type === "Default") return null;
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full inline-block" style={{ backgroundColor: colors.bg }} />
                  <span>{type}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Search Bar */}
        <div className="absolute top-4 right-4 z-10 w-64">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาข้อมูลเอนทิตี..."
              className="pl-9 h-9 bg-slate-900/80 backdrop-blur-sm border-slate-800 text-slate-200 placeholder:text-slate-500 text-xs focus:ring-slate-700 rounded-lg shadow-md"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchQuery && (
            <div className="absolute top-10 right-0 w-full bg-slate-900/95 border border-slate-800 rounded-lg max-h-48 overflow-y-auto z-20 shadow-xl divide-y divide-slate-800">
              {nodes
                .filter((n) => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((node) => (
                  <button
                    key={node.id}
                    onClick={() => {
                      handleSearchSelect(node);
                      setSearchQuery("");
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span className="font-medium truncate">{node.label}</span>
                    <span 
                      className="text-[9px] px-1 py-0.5 rounded border uppercase text-slate-400 scale-90 border-slate-800"
                      style={{ color: TYPE_COLORS[node.type]?.bg }}
                    >
                      {node.type}
                    </span>
                  </button>
                ))}
              {nodes.filter((n) => n.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div className="p-3 text-center text-xs text-slate-500">ไม่พบเอนทิตีที่สอดคล้อง</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Sidebar panel */}
      <Card className="h-full bg-slate-900/50 border-slate-800/80 shadow-inner flex flex-col justify-between overflow-hidden">
        <CardContent className="p-4 flex flex-col h-full overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-4 flex-1">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 break-words">{selectedNode.label}</h3>
                  <span 
                    className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mt-1.5 uppercase"
                    style={{ 
                      backgroundColor: `${TYPE_COLORS[selectedNode.type]?.bg}15`,
                      color: TYPE_COLORS[selectedNode.type]?.bg,
                      borderColor: `${TYPE_COLORS[selectedNode.type]?.bg}40`
                    }}
                  >
                    {selectedNode.type}
                  </span>
                </div>
                <Button size="icon" variant="ghost" className="size-6 text-slate-500 hover:text-slate-300 -mr-1.5" onClick={() => setSelectedNode(null)}>
                  <X className="size-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Info className="size-3" /> ข้อมูลบริบทความเชื่อมโยง
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 border border-slate-800/50 p-2.5 rounded-lg whitespace-pre-wrap">
                    {selectedNode.description || "ไม่มีคำอธิบายเพิ่มเติม"}
                  </p>
                </div>

                {/* Show connected relationships */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">เส้นความสัมพันธ์ความรู้</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {edges
                      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((edge) => {
                        const isSource = edge.source === selectedNode.id;
                        const partnerId = isSource ? edge.target : edge.source;
                        const partner = nodes.find((n) => n.id === partnerId);
                        
                        return (
                          <div 
                            key={edge.id} 
                            onClick={() => partner && handleSearchSelect(partner)}
                            className="p-2 bg-slate-950/20 hover:bg-slate-850/40 border border-slate-850/50 rounded-md text-[11px] text-slate-300 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between font-medium">
                              <span className="truncate max-w-[90px]">{isSource ? "เชื่อมโยงกับ" : "เชื่อมต่อจาก"}</span>
                              <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">{edge.type}</span>
                            </div>
                            <div className="text-slate-400 mt-1 font-semibold truncate hover:underline">
                              {partner?.label || `Node #${partnerId}`}
                            </div>
                            {edge.description && (
                              <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-2">{edge.description}</p>
                            )}
                          </div>
                        );
                      })}
                    {edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length === 0 && (
                      <div className="text-[11px] text-slate-500 italic p-1">ไม่มีโหนดเชื่อมโยงโดยตรง</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="size-10 rounded-full bg-slate-950/60 border border-slate-800 grid place-items-center mb-3">
                <Info className="size-5 text-slate-500" />
              </div>
              <p className="text-xs font-medium text-slate-300">รายละเอียดโครงข่าย</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
                คลิกเลือกโหนดใดโหนดหนึ่งบนแผนภาพเพื่อดูข้อมูลความสัมพันธ์เชิงลึก
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  );
}
