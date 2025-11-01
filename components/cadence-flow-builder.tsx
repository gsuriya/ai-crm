"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, X, Mail, Phone, Calendar, GitBranch, Clock, Play, Square, Settings, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export type BlockType = 'trigger' | 'email' | 'voicemail' | 'calendar' | 'conditional' | 'delay' | 'end';

export interface FlowBlock {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  config?: {
    subject?: string;
    body?: string;
    replyToThread?: boolean;
    script?: string;
    calendarTitle?: string;
    calendarDescription?: string;
    duration?: number;
    condition?: string;
    delayDays?: number;
    delayHours?: number;
  };
  connections?: string[]; // Array of connected block IDs
  truePath?: string;
  falsePath?: string;
}

const blockTypeConfig = {
  trigger: { 
    color: 'bg-purple-500', 
    label: 'Start', 
    icon: Play,
    canHaveMultipleOutputs: false,
  },
  email: { 
    color: 'bg-blue-500', 
    label: 'Send Email', 
    icon: Mail,
    canHaveMultipleOutputs: false,
  },
  voicemail: { 
    color: 'bg-orange-500', 
    label: 'Leave Voicemail', 
    icon: Phone,
    canHaveMultipleOutputs: false,
  },
  calendar: { 
    color: 'bg-green-500', 
    label: 'Send Calendar Invite', 
    icon: Calendar,
    canHaveMultipleOutputs: false,
  },
  conditional: { 
    color: 'bg-indigo-500', 
    label: 'If / Else', 
    icon: GitBranch,
    canHaveMultipleOutputs: true,
  },
  delay: { 
    color: 'bg-yellow-500', 
    label: 'Wait', 
    icon: Clock,
    canHaveMultipleOutputs: false,
  },
  end: { 
    color: 'bg-gray-500', 
    label: 'End', 
    icon: Square,
    canHaveMultipleOutputs: false,
  },
};

interface CadenceFlowBuilderProps {
  initialBlocks?: FlowBlock[];
  cadenceId?: string; // Optional: if editing existing cadence
  cadenceName?: string; // Optional: name of the cadence
  cadenceDescription?: string; // Optional: description of the cadence
  onSave?: (blocks: FlowBlock[], name?: string, description?: string) => void;
  onClose?: () => void;
  autoSave?: boolean; // Whether to auto-save to Supabase
}

export function CadenceFlowBuilder({ initialBlocks = [], cadenceId, cadenceName = '', cadenceDescription = '', onSave, onClose, autoSave = false }: CadenceFlowBuilderProps) {
  // Normalize initial blocks: ensure exactly one trigger block
  const normalizeInitialBlocks = (blocks: FlowBlock[]): FlowBlock[] => {
    if (blocks.length === 0) {
      return [{
        id: '1',
        type: 'trigger',
        x: 400,
        y: 100,
        title: 'Cadence starts',
        connections: [],
      }];
    }
    
    // Find all trigger blocks
    const triggerBlocks = blocks.filter(b => b.type === 'trigger');
    const nonTriggerBlocks = blocks.filter(b => b.type !== 'trigger');
    
    // If no trigger block, add one
    if (triggerBlocks.length === 0) {
      return [{
        id: '1',
        type: 'trigger',
        x: 400,
        y: 100,
        title: 'Cadence starts',
        connections: [],
      }, ...nonTriggerBlocks];
    }
    
    // If multiple trigger blocks, keep only the first one
    if (triggerBlocks.length > 1) {
      return [triggerBlocks[0], ...nonTriggerBlocks];
    }
    
    // Exactly one trigger block - return as is
    return blocks;
  };

  const [blocks, setBlocks] = useState<FlowBlock[]>(normalizeInitialBlocks(initialBlocks));
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [configuringBlock, setConfiguringBlock] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(cadenceName || '');
  const [description, setDescription] = useState(cadenceDescription || '');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectionPoint, setConnectionPoint] = useState<'output' | 'true' | 'false' | null>(null);
  const [draggingConnection, setDraggingConnection] = useState<{ fromX: number; fromY: number; point: 'output' | 'true' | 'false' } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [connectionStartPos, setConnectionStartPos] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [isChatScrolled, setIsChatScrolled] = useState(false);
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);

  const handleSave = async () => {
    setSaved(true);
    
    // Normalize blocks before saving (ensure exactly one trigger block)
    const normalizedBlocks = normalizeInitialBlocks(blocks);
    
    // Update state if blocks were normalized
    if (normalizedBlocks.length !== blocks.length || 
        normalizedBlocks.some((b, i) => b.id !== blocks[i]?.id || b.type !== blocks[i]?.type)) {
      setBlocks(normalizedBlocks);
    }
    
    // Auto-save to Supabase if cadenceId is provided
    if (autoSave && cadenceId) {
      try {
        const { error } = await supabase
          .from('cadences')
          .update({
            nodes: normalizedBlocks,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cadenceId);

        if (error) {
          console.error('Error auto-saving:', error);
        }
      } catch (error) {
        console.error('Error auto-saving:', error);
      }
    }
    
    if (onSave) {
      onSave(normalizedBlocks, name, description);
    }
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBlockClick = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFrom) {
      // Connecting to this block
      handleConnectBlocks(connectingFrom, blockId, connectionPoint);
      setConnectingFrom(null);
      setConnectionPoint(null);
    } else {
      setSelectedBlock(blockId === selectedBlock ? null : blockId);
    }
  };

  const handleConnectBlocks = (fromId: string, toId: string, point: 'output' | 'true' | 'false' | null) => {
    setBlocks(prev => prev.map(block => {
      if (block.id === fromId) {
        const newBlock = { ...block };
        if (block.type === 'conditional') {
          // Conditional blocks can have both true and false paths
          if (point === 'true') {
            newBlock.truePath = toId;
          } else if (point === 'false') {
            newBlock.falsePath = toId;
          }
        } else {
          // Non-conditional blocks can only have ONE connection
          // Replace any existing connection instead of adding to it
          newBlock.connections = [toId];
        }
        return newBlock;
      }
      return block;
    }));
    // Don't auto-save on connection - user must click Save Cadence button
  };

  const handleStartConnection = (blockId: string, point: 'output' | 'true' | 'false', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const blockWidth = 280;
    const blockHeight = block.subtitle ? 70 : 50;
    const labelHeight = 20;
    const totalBlockHeight = blockHeight + labelHeight;
    
    // Calculate connection point position
    let fromX: number;
    let fromY = block.y + totalBlockHeight;
    
    if (point === 'true') {
      fromX = block.x;
    } else if (point === 'false') {
      fromX = block.x + blockWidth;
    } else {
      fromX = block.x + blockWidth / 2;
    }
    
    // Transform to screen coordinates for the dragging line
    const screenX = fromX * zoom + pan.x;
    const screenY = fromY * zoom + pan.y;
    
    // Start drag connection
    setConnectingFrom(blockId);
    setConnectionPoint(point);
    setDraggingConnection({
      fromX: screenX,
      fromY: screenY,
      point,
    });
    
    // Track initial mouse position to detect if it's a click vs drag
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setConnectionStartPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleBlockDragStart = (e: React.MouseEvent, blockId: string) => {
    if (connectingFrom || isPanning) return; // Don't drag while connecting or panning
    if (e.target && (e.target as HTMLElement).closest('button')) return; // Don't drag if clicking buttons
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    e.preventDefault();
    e.stopPropagation();
    setDragging(blockId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      // Account for zoom and pan when calculating drag offset
      const relativeX = (e.clientX - rect.left - pan.x) / zoom;
      const relativeY = (e.clientY - rect.top - pan.y) / zoom;
      setDragOffset({
        x: relativeX - block.x,
        y: relativeY - block.y,
      });
    }
  };

  const handleAddBlock = (type: BlockType) => {
    const newBlock: FlowBlock = {
      id: Date.now().toString(),
      type,
      x: 400 + Math.random() * 200,
      y: 300 + Math.random() * 200,
      title: getDefaultTitle(type),
      connections: [],
      config: getDefaultConfig(type),
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlock(newBlock.id);
  };

  const getDefaultTitle = (type: BlockType): string => {
    switch (type) {
      case 'email': return 'Send email';
      case 'voicemail': return 'Leave voicemail';
      case 'calendar': return 'Send calendar invite';
      case 'conditional': return 'Check condition';
      case 'delay': return 'Wait 1 day';
      case 'end': return 'End cadence';
      default: return 'Start';
    }
  };

  const getDefaultConfig = (type: BlockType) => {
    switch (type) {
      case 'email':
        return { subject: '', body: '', replyToThread: false };
      case 'voicemail':
        return { script: '' };
      case 'calendar':
        return { calendarTitle: '', calendarDescription: '', duration: 30 };
      case 'conditional':
        return { condition: '' };
      case 'delay':
        return { delayDays: 1, delayHours: 0 };
      default:
        return {};
    }
  };

  useEffect(() => {
    if (dragging) {
      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current || !dragging) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Account for zoom and pan
        const newX = ((e.clientX - rect.left - pan.x) / zoom) - dragOffset.x;
        const newY = ((e.clientY - rect.top - pan.y) / zoom) - dragOffset.y;
        
        setBlocks(prev => prev.map(block =>
          block.id === dragging ? { ...block, x: newX, y: newY } : block
        ));
      };

      const handleMouseUp = () => {
        if (dragging) {
          setDragging(null);
          // Only auto-save if it's an existing cadence (autoSave is true)
          if (autoSave) {
            handleSave();
          }
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    } else if (draggingConnection) {
      // Handle connection dragging
      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Track mouse position accounting for zoom and pan
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      };

      const handleMouseUp = (e: MouseEvent) => {
        // If we're dragging a connection, check if we're over a block
        if (draggingConnection && connectingFrom && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const currentX = e.clientX - rect.left;
          const currentY = e.clientY - rect.top;
          
          // Check if mouse moved significantly (more than 5px) - if not, treat as click
          const moved = connectionStartPos && (
            Math.abs(currentX - connectionStartPos.x) > 5 || 
            Math.abs(currentY - connectionStartPos.y) > 5
          );
          
          if (moved) {
            // Dragged - check if we're over a block
            const target = document.elementFromPoint(e.clientX, e.clientY);
            const blockElement = target?.closest('[data-block-id]');
            
            if (blockElement) {
              const targetBlockId = blockElement.getAttribute('data-block-id');
              if (targetBlockId && targetBlockId !== connectingFrom) {
                handleConnectBlocks(connectingFrom, targetBlockId, connectionPoint);
              }
            }
            // Clear connection state after drag
            setDraggingConnection(null);
            setMousePosition(null);
            setConnectionStartPos(null);
          } else {
            // Clicked - stay in connection mode (don't clear connectingFrom)
            // The next click on a block will connect them
            setDraggingConnection(null);
            setMousePosition(null);
            setConnectionStartPos(null);
          }
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, dragOffset, draggingConnection, connectingFrom, connectionPoint, connectionStartPos, autoSave, pan, zoom]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.25, Math.min(2, prev + delta)));
  };

  const handlePanStart = (e: React.MouseEvent) => {
    // Only pan if clicking on canvas background (not on blocks or buttons)
    if ((e.target as HTMLElement).closest('[data-block-id]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePanMove = (e: MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanEnd);
      return () => {
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanEnd);
      };
    }
  }, [isPanning, panStart]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Reset bottom state when new messages arrive
    setTimeout(() => {
      setIsChatAtBottom(true);
      setIsChatScrolled(false);
    }, 100);
  }, [chatMessages, isChatLoading]);

  // Track scroll position for gradient visibility
  useEffect(() => {
    const messagesContainer = chatMessagesRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      const container = messagesContainer;
      setIsChatScrolled(container.scrollTop > 10);
      // Check if near bottom (within 20px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 20;
      setIsChatAtBottom(isNearBottom);
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => {
      messagesContainer.removeEventListener('scroll', handleScroll);
    };
  }, [isChatFocused, isChatOpen, chatMessages.length]);

  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Make zoom more responsive - scale delta proportionally
      // For touch gestures, deltaY can be very large (hundreds), so we scale it down
      const sensitivity = 0.002; // Increased sensitivity for better responsiveness
      const delta = -(e.deltaY * sensitivity); // Negative because zoom out when scrolling down
      handleZoom(delta);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoom]);

  const updateBlockConfig = (blockId: string, config: Partial<FlowBlock['config']>) => {
    setBlocks(prev => prev.map(block =>
      block.id === blockId
        ? { ...block, config: { ...block.config, ...config } }
        : block
    ));
  };

  const updateBlockTitle = (blockId: string, title: string) => {
    setBlocks(prev => prev.map(block =>
      block.id === blockId ? { ...block, title } : block
    ));
  };

  const renderConnectionLine = (from: FlowBlock, to: FlowBlock, isTruePath = false, isFalsePath = false) => {
    // Calculate block dimensions
    const blockWidth = 280;
    const blockHeight = from.subtitle ? 70 : 50;
    const labelHeight = 20;
    const totalBlockHeight = blockHeight + labelHeight;
    
    // Connection points: bottom-center of source, top-center of target
    const fromX = from.x + blockWidth / 2;
    const fromY = from.y + totalBlockHeight;
    const toX = to.x + blockWidth / 2;
    const toY = to.y + labelHeight;

    // For conditional branches, connect from left/right side
    if (isTruePath || isFalsePath) {
      const branchFromX = isTruePath ? from.x : from.x + blockWidth;
      const branchFromY = from.y + totalBlockHeight;
      
      // Calculate clean curve
      const dx = toX - branchFromX;
      const dy = toY - branchFromY;
      const horizontalOffset = isTruePath ? -80 : 80;
      const verticalOffset = Math.max(50, Math.abs(dy) * 0.4);
      
      const controlX = branchFromX + horizontalOffset;
      const controlY = branchFromY + verticalOffset;
      
      return (
        <path
          key={`${from.id}-${to.id}-${isTruePath ? 'true' : 'false'}`}
          d={`M ${branchFromX} ${branchFromY} Q ${controlX} ${controlY} ${toX} ${toY}`}
          stroke="#4b5563"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#arrowhead)"
          className="pointer-events-none"
        />
      );
    }

    // Calculate distance and direction
    const dx = toX - fromX;
    const dy = toY - fromY;
    const horizontalDistance = Math.abs(dx);
    const verticalDistance = Math.abs(dy);
    
    // Simple rule: if blocks are mostly vertical and well-aligned, use straight line
    if (verticalDistance > horizontalDistance * 1.5 && Math.abs(dx) < 30) {
      // Vertically stacked and well-aligned: straight line
      return (
        <line
          key={`${from.id}-${to.id}`}
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke="#4b5563"
          strokeWidth="1.5"
          markerEnd="url(#arrowhead)"
          className="pointer-events-none"
        />
      );
    }
    
    // For side-by-side or misaligned blocks: use smooth curve
    if (horizontalDistance > 50 || Math.abs(dx) > 30) {
      // Calculate smooth curve
      const controlX = (fromX + toX) / 2;
      const controlY = fromY + Math.max(40, Math.abs(dy) * 0.25 + 40);
      
      return (
        <path
          key={`${from.id}-${to.id}`}
          d={`M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`}
          stroke="#4b5563"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#arrowhead)"
          className="pointer-events-none"
        />
      );
    }
    
    // Default: straight line for close blocks
    return (
      <line
        key={`${from.id}-${to.id}`}
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke="#4b5563"
        strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
        className="pointer-events-none"
      />
    );
  };

  const renderBlock = (block: FlowBlock) => {
    const config = blockTypeConfig[block.type];
    const Icon = config.icon;
    const isSelected = selectedBlock === block.id;
    const isConfiguring = configuringBlock === block.id;
    const isConditional = block.type === 'conditional';

    return (
      <div key={block.id}>
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: dragging === block.id ? 1.02 : 1 }}
          style={{
            position: 'absolute',
            left: `${block.x}px`,
            top: `${block.y}px`,
            zIndex: dragging === block.id ? 50 : isSelected ? 10 : 1,
          }}
          className={dragging === block.id ? "cursor-grabbing" : "cursor-move"}
          data-block-id={block.id}
          onMouseDown={(e) => {
            // Only start dragging if clicking on the block itself, not buttons
            if (!(e.target as HTMLElement).closest('button')) {
              handleBlockDragStart(e, block.id);
            }
          }}
          onClick={(e) => {
            if (!dragging && !draggingConnection) {
              handleBlockClick(block.id, e);
            }
          }}
        >
          {/* Label badge */}
          <div className={`${config.color} text-white text-[10px] font-semibold px-3 py-1 rounded-t-md inline-flex items-center gap-1.5`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </div>

          {/* Main block */}
          <div
            className={`bg-white rounded-lg rounded-tl-none shadow-sm border-2 ${
              isSelected ? 'border-blue-500' : connectingFrom === block.id ? 'border-green-500' : 'border-gray-200'
            } relative`}
            style={{ width: '280px', minHeight: '60px' }}
          >
            <div className="p-3">
              <div className="text-sm font-medium text-gray-900">
                {block.title}
              </div>
              {block.subtitle && (
                <div className="text-xs text-gray-600 mt-1">{block.subtitle}</div>
              )}
              {block.config && (
                <div className="text-xs text-gray-500 mt-1">
                  {block.type === 'email' && block.config.subject && (
                    <div>Subject: {block.config.subject}</div>
                  )}
                  {block.type === 'delay' && (
                    <div>
                      {block.config.delayDays} day{block.config.delayDays !== 1 ? 's' : ''}
                      {block.config.delayHours && block.config.delayHours > 0 && ` ${block.config.delayHours} hour${block.config.delayHours !== 1 ? 's' : ''}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Connection points */}
            {block.type !== 'end' && (
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                <button
                  onMouseDown={(e) => handleStartConnection(block.id, 'output', e)}
                  className={`w-6 h-6 rounded-full border-2 ${
                    connectingFrom === block.id && connectionPoint === 'output'
                      ? 'bg-green-500 border-green-600'
                      : 'bg-white border-gray-400 hover:border-blue-500'
                  } transition-colors cursor-grab active:cursor-grabbing`}
                  title="Drag or click to connect"
                >
                  <ArrowDown className="h-3 w-3 mx-auto text-gray-600" />
                </button>
              </div>
            )}

            {isConditional && (
              <>
                <div className="absolute bottom-0 left-0 transform translate-y-1/2">
                  <button
                    onMouseDown={(e) => handleStartConnection(block.id, 'true', e)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      connectingFrom === block.id && connectionPoint === 'true'
                        ? 'bg-green-500 border-green-600'
                        : 'bg-white border-gray-400 hover:border-blue-500'
                    } transition-colors flex items-center justify-center cursor-grab active:cursor-grabbing`}
                    title="True path - drag or click to connect"
                  >
                    <span className="text-[10px] font-bold text-gray-600">T</span>
                  </button>
                </div>
                <div className="absolute bottom-0 right-0 transform translate-y-1/2">
                  <button
                    onMouseDown={(e) => handleStartConnection(block.id, 'false', e)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      connectingFrom === block.id && connectionPoint === 'false'
                        ? 'bg-green-500 border-green-600'
                        : 'bg-white border-gray-400 hover:border-blue-500'
                    } transition-colors flex items-center justify-center cursor-grab active:cursor-grabbing`}
                    title="False path - drag or click to connect"
                  >
                    <span className="text-[10px] font-bold text-gray-600">F</span>
                  </button>
                </div>
              </>
            )}

            {/* Settings button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfiguringBlock(isConfiguring ? null : block.id);
              }}
              className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 transition-colors"
              title="Configure block"
            >
              <Settings className="h-4 w-4 text-gray-500" />
            </button>

            {/* Delete button */}
            {block.type !== 'trigger' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this block?')) {
                    setBlocks(prev => {
                      // Remove the block
                      const newBlocks = prev.filter(b => b.id !== block.id);
                      // Remove connections to this block
                      return newBlocks.map(b => ({
                        ...b,
                        connections: b.connections?.filter(c => c !== block.id),
                        truePath: b.truePath === block.id ? undefined : b.truePath,
                        falsePath: b.falsePath === block.id ? undefined : b.falsePath,
                      }));
                    });
                    // Don't auto-save on delete - user must click Save Cadence button
                  }
                }}
                className="absolute top-2 right-10 p-1 rounded hover:bg-red-100 transition-colors"
                title="Delete block"
              >
                <X className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Configuration panel */}
        {isConfiguring && (
          <div
            className="absolute bg-white border-2 border-blue-500 rounded-lg shadow-xl p-4 z-50"
            style={{
              left: `${block.x + 300}px`,
              top: `${block.y}px`,
              width: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Configure Block</h3>
              <button onClick={() => setConfiguringBlock(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input
                  value={block.title}
                  onChange={(e) => updateBlockTitle(block.id, e.target.value)}
                  placeholder="Block title"
                />
              </div>

              {block.type === 'email' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Subject</label>
                    <Input
                      value={block.config?.subject || ''}
                      onChange={(e) => updateBlockConfig(block.id, { subject: e.target.value })}
                      placeholder="Email subject"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Body</label>
                    <textarea
                      value={block.config?.body || ''}
                      onChange={(e) => updateBlockConfig(block.id, { body: e.target.value })}
                      placeholder="Email body"
                      className="w-full min-h-[100px] p-2 border rounded"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={block.config?.replyToThread || false}
                      onChange={(e) => updateBlockConfig(block.id, { replyToThread: e.target.checked })}
                      id={`reply-${block.id}`}
                    />
                    <label htmlFor={`reply-${block.id}`} className="text-sm">
                      Reply in thread (continues conversation)
                    </label>
                  </div>
                </>
              )}

              {block.type === 'voicemail' && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Script</label>
                  <textarea
                    value={block.config?.script || ''}
                    onChange={(e) => updateBlockConfig(block.id, { script: e.target.value })}
                    placeholder="Voicemail script"
                    className="w-full min-h-[100px] p-2 border rounded"
                  />
                </div>
              )}

              {block.type === 'calendar' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Event Title</label>
                    <Input
                      value={block.config?.calendarTitle || ''}
                      onChange={(e) => updateBlockConfig(block.id, { calendarTitle: e.target.value })}
                      placeholder="Meeting title"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Description</label>
                    <textarea
                      value={block.config?.calendarDescription || ''}
                      onChange={(e) => updateBlockConfig(block.id, { calendarDescription: e.target.value })}
                      placeholder="Event description"
                      className="w-full min-h-[80px] p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Duration (minutes)</label>
                    <Input
                      type="number"
                      value={block.config?.duration || 30}
                      onChange={(e) => updateBlockConfig(block.id, { duration: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                </>
              )}

              {block.type === 'conditional' && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Condition</label>
                  <Input
                    value={block.config?.condition || ''}
                    onChange={(e) => updateBlockConfig(block.id, { condition: e.target.value })}
                    placeholder="e.g., Email opened, Response received"
                  />
                </div>
              )}

              {block.type === 'delay' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Days</label>
                    <Input
                      type="number"
                      value={block.config?.delayDays || 1}
                      onChange={(e) => updateBlockConfig(block.id, { delayDays: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Hours</label>
                    <Input
                      type="number"
                      value={block.config?.delayHours || 0}
                      onChange={(e) => updateBlockConfig(block.id, { delayHours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </>
              )}
            </div>

            <Button className="mt-4 w-full" onClick={() => {
              setConfiguringBlock(null);
              handleSave();
            }}>
              Save Configuration
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Cadence Flow Builder</h2>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium"
                >
                  <Check className="h-4 w-4" />
                  Changes saved
                </motion.div>
              )}
            </AnimatePresence>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Cadence Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter cadence name"
              className="w-full"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                if (!name.trim()) {
                  alert('Please enter a cadence name');
                  return;
                }
                handleSave();
              }}
              disabled={!name.trim()}
            >
              Save Cadence
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Block palette */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-3">Add Block</h3>
          <div className="space-y-2">
            {Object.entries(blockTypeConfig)
              .filter(([type]) => type !== 'trigger') // Exclude trigger/start block from palette
              .map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => handleAddBlock(type as BlockType)}
                    className="w-full flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className={`${config.color} p-2 rounded`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{config.label}</div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{
            backgroundColor: '#fafafa',
          }}
          onClick={(e) => {
            e.stopPropagation(); // Prevent modal from closing
            if (connectingFrom) {
              setConnectingFrom(null);
              setConnectionPoint(null);
            }
            setSelectedBlock(null);
            // Close chat if clicking outside (but keep messages visible if they exist)
            if (isChatFocused && !(e.target as HTMLElement).closest('[data-chat-container]')) {
              setIsChatFocused(false);
              // Only close completely if no messages
              if (chatMessages.length === 0) {
                setIsChatOpen(false);
              }
            }
          }}
          onMouseDown={(e) => {
            e.stopPropagation(); // Prevent modal from closing when clicking canvas
            handlePanStart(e);
          }}
        >
          {/* Floating Chat Overlay - Compact & Clean */}
          <div 
            data-chat-container
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center"
          >
            {/* Chat Messages - Compact, centered with fade gradients */}
            <AnimatePresence>
              {isChatFocused && isChatOpen && chatMessages.length > 0 && (
                <motion.div
                  ref={chatMessagesRef}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="mb-2 max-h-48 overflow-y-auto space-y-1.5 w-full flex flex-col items-center pointer-events-auto px-2 relative scroll-smooth"
                >
                  {/* Fade gradient at top - only show when scrolled */}
                  {isChatScrolled && (
                    <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background/80 via-background/40 to-transparent pointer-events-none z-10" />
                  )}
                  
                  {chatMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.2, ease: "easeOut" }}
                      className="w-full flex justify-center"
                    >
                      <div
                        className={`max-w-md rounded-lg px-3 py-1.5 text-xs shadow-md backdrop-blur-md ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-white/95 text-foreground border border-border/20'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                  {isChatLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-center"
                    >
                      <div className="bg-white/95 backdrop-blur-md rounded-lg px-3 py-1.5 shadow-md border border-border/20">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '120ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '240ms' }}></span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Fade gradient at bottom - only show when not at bottom */}
                  {!isChatAtBottom && (
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/80 via-background/40 to-transparent pointer-events-none z-10" />
                  )}
                  
                  <div ref={chatEndRef} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Bar - Refined with better animations */}
            <motion.div
              initial={{ width: '160px', opacity: 0.8 }}
              animate={{ 
                width: isChatFocused ? '480px' : '160px',
                opacity: 1
              }}
              transition={{ 
                duration: 0.25, 
                ease: [0.4, 0, 0.2, 1],
                opacity: { duration: 0.15 }
              }}
              className="relative flex items-center bg-background/95 backdrop-blur-md border border-border rounded-full px-3 py-2 shadow-lg focus-within:ring-1 focus-within:ring-ring focus-within:border-ring focus-within:shadow-xl transition-all pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                setIsChatFocused(true);
                chatInputRef.current?.focus();
              }}
            >
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  if (!isChatOpen) setIsChatOpen(true);
                }}
                onFocus={() => {
                  setIsChatFocused(true);
                  setIsChatOpen(true);
                }}
                onBlur={(e) => {
                  if (!(e.relatedTarget as HTMLElement)?.closest('[data-chat-container]')) {
                    setTimeout(() => {
                      if (!chatInput.trim() && chatMessages.length === 0) {
                        setIsChatFocused(false);
                      }
                    }, 100);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!chatInput.trim() || isChatLoading) return;

                    const userMessage = chatInput.trim();
                    setChatInput('');
                    setIsChatOpen(true);
                    setIsChatFocused(true);
                    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
                    setIsChatLoading(true);

                    fetch('/api/cadence-chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: userMessage,
                        blocks,
                        name,
                        description,
                      }),
                    })
                      .then(response => {
                        if (!response.ok) throw new Error('Failed to get response');
                        return response.json();
                      })
                      .then(data => {
                        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
                      })
                      .catch(error => {
                        console.error('Error sending chat message:', error);
                        setChatMessages(prev => [
                          ...prev,
                          { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
                        ]);
                      })
                      .finally(() => {
                        setIsChatLoading(false);
                      });
                  }
                }}
                placeholder={isChatFocused ? "Ask about your workflow..." : "Ask..."}
                className="flex-1 bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground pr-2 min-w-0"
                disabled={isChatLoading}
              />
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!chatInput.trim() || isChatLoading) return;

                  const userMessage = chatInput.trim();
                  setChatInput('');
                  setIsChatOpen(true);
                  setIsChatFocused(true);
                  setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
                  setIsChatLoading(true);

                  try {
                    const response = await fetch('/api/cadence-chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: userMessage,
                        blocks,
                        name,
                        description,
                      }),
                    });

                    if (!response.ok) {
                      throw new Error('Failed to get response');
                    }

                    const data = await response.json();
                    setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
                  } catch (error) {
                    console.error('Error sending chat message:', error);
                    setChatMessages(prev => [
                      ...prev,
                      { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
                    ]);
                  } finally {
                    setIsChatLoading(false);
                  }
                }}
                disabled={!chatInput.trim() || isChatLoading}
                className="ml-1.5 flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all disabled:hover:bg-primary flex-shrink-0"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
            </motion.div>
          </div>

          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              <defs>
                {/* Grid pattern for infinite dots */}
                <pattern
                  id="grid-pattern"
                  x="0"
                  y="0"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="10" cy="10" r="1" fill="#9ca3af" />
                </pattern>
              </defs>
              
              {/* Infinite grid background */}
              <rect
                x="-10000"
                y="-10000"
                width="20000"
                height="20000"
                fill="url(#grid-pattern)"
              />
              
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M 0 0 L 8 3 L 0 6 Z" fill="#4b5563" />
                </marker>
                <marker
                  id="arrowhead-blue"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M 0 0 L 8 3 L 0 6 Z" fill="#60a5fa" />
                </marker>
              </defs>

              {blocks.map(block => {
                const connections = [];
                
                if (block.connections) {
                  block.connections.forEach(connId => {
                    const targetBlock = blocks.find(b => b.id === connId);
                    if (targetBlock) {
                      connections.push(
                        <g key={`${block.id}-${connId}`}>
                          {renderConnectionLine(block, targetBlock)}
                        </g>
                      );
                    }
                  });
                }
                
                if (block.truePath) {
                  const targetBlock = blocks.find(b => b.id === block.truePath);
                  if (targetBlock) {
                    connections.push(
                      <g key={`${block.id}-${block.truePath}-true`}>
                        {renderConnectionLine(block, targetBlock, true, false)}
                      </g>
                    );
                  }
                }
                
                if (block.falsePath) {
                  const targetBlock = blocks.find(b => b.id === block.falsePath);
                  if (targetBlock) {
                    connections.push(
                      <g key={`${block.id}-${block.falsePath}-false`}>
                        {renderConnectionLine(block, targetBlock, false, true)}
                      </g>
                    );
                  }
                }

                return connections;
              })}
            </g>

            {/* Temporary connection line while dragging (in screen space, not transformed) */}
            {draggingConnection && mousePosition && (
              <line
                x1={draggingConnection.fromX}
                y1={draggingConnection.fromY}
                x2={mousePosition.x}
                y2={mousePosition.y}
                stroke="#60a5fa"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead-blue)"
                className="pointer-events-none"
              />
            )}
          </svg>

          <div 
            className="relative" 
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {blocks.map(block => renderBlock(block))}
          </div>
        </div>
      </div>
    </div>
  );
}
