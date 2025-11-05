"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, X, Mail, Phone, Calendar, GitBranch, Clock, Play, Square, Settings, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export type BlockType = 'trigger' | 'email' | 'voicecall' | 'calendar' | 'conditional' | 'delay' | 'end';

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
    replyToThread?: boolean; // Legacy: true = reply to previous email
    threadSelection?: 'new' | string; // 'new' for new thread, or block ID to reply to
    script?: string;
    customPrompt?: string; // Custom system prompt for voice calls
    voicemailMessage?: string; // Custom voicemail message if call goes to voicemail
    enableVoicemailFallback?: boolean; // Whether to leave voicemail if not answered
    calendarTitle?: string;
    calendarDescription?: string;
    duration?: number;
    timeConstraint?: 'none' | 'business_hours'; // 'none' or 'business_hours' (9am-5pm)
    checkAvailability?: boolean; // Whether to check availability before scheduling
    condition?: string;
    conditionType?: 'email_opened' | 'email_not_opened' | 'email_replied' | 'email_not_replied' | 'email_opened_within_days' | 'email_replied_within_days';
    conditionValue?: string; // For "within_days" conditions
    delayDays?: number;
    delayHours?: number;
    delayMinutes?: number;
    delaySeconds?: number;
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
    canHaveMultipleOutputs: true, // Trigger can have multiple connections
  },
  email: { 
    color: 'bg-blue-500', 
    label: 'Send Email', 
    icon: Mail,
    canHaveMultipleOutputs: false,
  },
  voicecall: { 
    color: 'bg-orange-500', 
    label: 'Voice Call', 
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
  companyId?: string; // Optional: company ID for workflow execution
  onSave?: (blocks: FlowBlock[], name?: string, description?: string) => void;
  onClose?: (force?: boolean) => void;
  autoSave?: boolean; // Whether to auto-save to Supabase
  onChanges?: (hasChanges: boolean) => void; // Callback when changes are detected
  saveSuccess?: boolean; // Whether save was successful (to show message)
}

export function CadenceFlowBuilder({ initialBlocks = [], cadenceId, cadenceName = '', cadenceDescription = '', companyId, onSave, onClose, autoSave = false, onChanges, saveSuccess = false }: CadenceFlowBuilderProps) {
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [isChatScrolled, setIsChatScrolled] = useState(false);
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);
  const [hasScrollableContent, setHasScrollableContent] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  // Local state for delay inputs to allow clearing
  const [delayInputs, setDelayInputs] = useState<Record<string, { seconds?: string; minutes?: string; hours?: string; days?: string }>>({});

  // Execute workflow starting from trigger block - NOW READS FROM SUPABASE
  const executeWorkflow = async () => {
    if (isExecuting) return;
    
    // Check if we have companyId and cadenceId for real execution
    if (!companyId || !cadenceId) {
      alert('To run a workflow, go to a company\'s detail page and click "Add to Cadence".\n\nThe cadence builder is for designing workflows, not running them. Workflows need to be associated with a specific company.');
      return;
    }
    
    setIsExecuting(true);
    setExecutionLog([]);
    
    const log = (message: string) => {
      setExecutionLog(prev => [...prev, message]);
      console.log(`[Workflow] ${message}`);
    };

    try {
      // IMPORTANT: Fetch cadence and blocks from Supabase, not local state
      log('📥 Fetching cadence from Supabase...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        log('❌ User not authenticated');
        setIsExecuting(false);
        return;
      }

      const { data: cadence, error: cadenceError } = await supabase
        .from('cadences')
        .select('*')
        .eq('id', cadenceId)
        .eq('user_id', user.id)
        .single();

      if (cadenceError || !cadence) {
        log(`❌ Failed to load cadence: ${cadenceError?.message || 'Not found'}`);
        setIsExecuting(false);
        return;
      }

      const blocksFromSupabase = (cadence.nodes || []) as FlowBlock[];
      if (!blocksFromSupabase || blocksFromSupabase.length === 0) {
        log('❌ Cadence has no blocks');
        setIsExecuting(false);
        return;
      }

      log(`✅ Loaded ${blocksFromSupabase.length} blocks from Supabase`);

      // Get company email for sending emails
      const { data: company } = await supabase
        .from('companies')
        .select('email')
        .eq('id', companyId)
        .single();

      // Use hardcoded email for testing: ethanzzheng@gmail.com
      const companyEmail = 'ethanzzheng@gmail.com';
      if (!companyEmail) {
        log('⚠️ Company email not found. Some blocks may fail.');
      }

      // Find trigger block
      const triggerBlock = blocksFromSupabase.find(b => b.type === 'trigger');
      if (!triggerBlock) {
        log('❌ No trigger block found');
        setIsExecuting(false);
        return;
      }

      log(`🚀 Starting workflow from: ${triggerBlock.title}`);
      log(`📊 Using blocks from Supabase (not local browser state)`);

      // Track thread info for each email block (blockId -> { threadId, messageId })
      const threadInfoMap = new Map<string, { threadId: string; messageId: string }>();

      // Execute workflow recursively using Supabase blocks
      const executeBlock = async (blockId: string): Promise<void> => {
        const block = blocksFromSupabase.find(b => b.id === blockId);
        if (!block) {
          log(`⚠️ Block ${blockId} not found`);
          return;
        }

        // Execute based on block type
        switch (block.type) {
          case 'email':
            log(`📧 Executing: ${block.title}`);
            log(`   Subject: ${block.config?.subject || '(empty)'}`);
            log(`   Body: ${block.config?.body || '(empty)'}`);
            
            try {
              // Determine thread selection
              const threadSelection = block.config?.threadSelection || 
                                     (block.config?.replyToThread ? 'previous' : 'new'); // Support legacy
              
              let threadId: string | undefined = undefined;
              let messageId: string | undefined = undefined;
              
              if (threadSelection !== 'new') {
                // Find the thread info from the selected block
                const selectedBlockId = threadSelection === 'previous' 
                  ? blocksFromSupabase.find(b => b.type === 'email' && b.id !== block.id && threadInfoMap.has(b.id))?.id
                  : threadSelection;
                
                if (selectedBlockId && threadInfoMap.has(selectedBlockId)) {
                  const threadInfo = threadInfoMap.get(selectedBlockId)!;
                  threadId = threadInfo.threadId;
                  // Ensure messageId is in correct format with angle brackets if not already
                  let msgId = threadInfo.messageId;
                  if (msgId && !msgId.startsWith('<')) {
                    msgId = `<${msgId}>`;
                  }
                  messageId = msgId;
                  log(`   Replying to thread from block ${selectedBlockId}`);
                  log(`   Thread ID: ${threadId}, Message ID: ${messageId}`);
                  
                  // IMPORTANT: Use the original subject exactly as stored
                  const originalSubject = blocksFromSupabase.find(b => b.id === selectedBlockId)?.config?.subject || '';
                  if (originalSubject) {
                    // Force subject to match original for threading
                    block.config = { ...block.config, subject: originalSubject };
                    log(`   Subject locked to: "${originalSubject}"`);
                  }
                } else {
                  log(`   ⚠️ Warning: Selected thread block not found or hasn't sent yet. Creating new thread.`);
                }
              } else {
                log(`   Creating new thread`);
              }
              
              const emailResponse = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to_email: companyEmail,
                  subject: block.config?.subject || '',
                  body: block.config?.body || '',
                  thread_id: threadId,
                  message_id: messageId,
                  company_id: companyId,
                  cadence_id: cadenceId,
                  user_id: user.id,
                }),
              });

              if (!emailResponse.ok) {
                const error = await emailResponse.json();
                throw new Error(error.error || 'Failed to send email');
              }

              const emailData = await emailResponse.json();
              
              // Store thread info for this block
              threadInfoMap.set(block.id, {
                threadId: emailData.threadId,
                messageId: emailData.messageId || emailData.gmailMessageId,
              });
              
              log(`   ✅ Email sent (Thread ID: ${emailData.threadId}, Message ID: ${emailData.messageId || 'N/A'})`);
            } catch (error: any) {
              log(`   ❌ Error sending email: ${error.message}`);
              throw error;
            }
            break;

          case 'voicecall':
            log(`📞 Executing: ${block.title}`);
            log(`   Making AI voice call to schedule meeting`);
            
            try {
              // Get company phone number
              const { data: companyMetadata } = await supabase
                .from('companies')
                .select('phone_number, name')
                .eq('id', companyId)
                .single();

              const phoneNumber = companyMetadata?.phone_number || '';
              if (!phoneNumber) {
                throw new Error('Company phone number not found');
              }

              const voiceCallResponse = await fetch('/api/voice-call/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone_number: phoneNumber,
                  company_id: companyId,
                  cadence_id: cadenceId,
                  company_name: companyMetadata?.name,
                  custom_prompt: block.config?.customPrompt,
                  voicemail_message: block.config?.voicemailMessage,
                  enable_voicemail_fallback: block.config?.enableVoicemailFallback !== false,
                }),
              });

              if (!voiceCallResponse.ok) {
                const error = await voiceCallResponse.json();
                throw new Error(error.error || 'Failed to initiate voice call');
              }

              const voiceCallData = await voiceCallResponse.json();
              log(`   ✅ Voice call initiated (Call ID: ${voiceCallData.callId})`);
            } catch (error: any) {
              log(`   ❌ Error initiating voice call: ${error.message}`);
              throw error;
            }
            break;

          case 'calendar':
            log(`📅 Executing: ${block.title}`);
            log(`   Title: ${block.config?.calendarTitle || '(empty)'}`);
            log(`   Description: ${block.config?.calendarDescription || '(empty)'}`);
            log(`   Duration: ${block.config?.duration || 30} minutes`);
            
            try {
              const calendarResponse = await fetch('/api/calendar/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to_email: companyEmail,
                  title: block.config?.calendarTitle || '',
                  description: block.config?.calendarDescription || '',
                  duration: block.config?.duration || 30,
                  company_id: companyId,
                  cadence_id: cadenceId,
                  user_id: user.id,
                }),
              });

              if (!calendarResponse.ok) {
                const error = await calendarResponse.json();
                throw new Error(error.error || 'Failed to send calendar invite');
              }

              const calendarData = await calendarResponse.json();
              log(`   ✅ Calendar invite sent (Event ID: ${calendarData.eventId})`);
            } catch (error: any) {
              log(`   ❌ Error sending calendar invite: ${error.message}`);
              throw error;
            }
            break;

          case 'conditional':
            log(`🔀 Executing: ${block.title}`);
            log(`   Condition: ${block.config?.conditionType || '(empty)'}`);
            
            try {
              const conditionType = block.config?.conditionType;
              if (!conditionType) {
                throw new Error('Condition type not configured');
              }

              const conditionResponse = await fetch('/api/cadence/condition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  company_id: companyId,
                  condition_type: conditionType,
                  condition_value: block.config?.conditionValue,
                }),
              });

              if (!conditionResponse.ok) {
                const error = await conditionResponse.json();
                throw new Error(error.error || 'Failed to evaluate condition');
              }

              const conditionData = await conditionResponse.json();
              const conditionResult = conditionData.result;
              log(`   Condition result: ${conditionResult ? 'TRUE' : 'FALSE'} (${conditionData.reason})`);
              
              if (conditionResult && block.truePath) {
                log(`   → Following TRUE path`);
                await executeBlock(block.truePath);
              } else if (!conditionResult && block.falsePath) {
                log(`   → Following FALSE path`);
                await executeBlock(block.falsePath);
              }
            } catch (error: any) {
              log(`   ❌ Error evaluating condition: ${error.message}`);
              throw error;
            }
            // Don't follow regular connections for conditional - return early
            return;

          case 'delay':
            log(`⏳ Executing: ${block.title}`);
            const days = block.config?.delayDays || 0;
            const hours = block.config?.delayHours || 0;
            log(`   Scheduling wait: ${days} day(s), ${hours} hour(s)`);
            
            // For demo/test purposes, use shorter delay (1 second per day/hour, max 5 seconds)
            // In production, this would be handled by the background job processor
            const demoDelay = Math.min((days * 24 + hours) * 1000, 5000);
            log(`   ⏳ Waiting ${demoDelay}ms (demo mode)...`);
            await new Promise(resolve => setTimeout(resolve, demoDelay));
            log(`   ✅ Wait completed`);
            break;

          case 'end':
            log(`🏁 Reached: ${block.title}`);
            return; // Stop execution

          case 'trigger':
            log(`▶️ Trigger: ${block.title}`);
            break;

          default:
            log(`⚠️ Unknown block type: ${block.type}`);
        }

        // Follow connections (conditional blocks return early, so they won't reach here)
        if (block.connections && block.connections.length > 0) {
          // For trigger blocks, execute all connections
          if (block.type === 'trigger') {
            for (const nextId of block.connections) {
              await executeBlock(nextId);
            }
          } else {
            // For other blocks, follow first connection
            await executeBlock(block.connections[0]);
          }
        }
      };

      // Start execution from trigger's connections
      if (triggerBlock.connections && triggerBlock.connections.length > 0) {
        for (const nextId of triggerBlock.connections) {
          await executeBlock(nextId);
        }
      }

      log(`✅ Workflow execution completed`);
    } catch (error: any) {
      log(`❌ Error executing workflow: ${error.message || error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Track changes by comparing current state with initial state
  useEffect(() => {
    if (!onChanges) return;

    const normalizedInitial = normalizeInitialBlocks(initialBlocks);
    const normalizedCurrent = normalizeInitialBlocks(blocks);
    
    // Deep comparison function
    const blocksEqual = (a: FlowBlock[], b: FlowBlock[]): boolean => {
      if (a.length !== b.length) return false;
      return a.every((blockA, i) => {
        const blockB = b[i];
        if (!blockB) return false;
        return (
          blockA.id === blockB.id &&
          blockA.type === blockB.type &&
          blockA.x === blockB.x &&
          blockA.y === blockB.y &&
          blockA.title === blockB.title &&
          blockA.subtitle === blockB.subtitle &&
          JSON.stringify(blockA.config) === JSON.stringify(blockB.config) &&
          JSON.stringify(blockA.connections) === JSON.stringify(blockB.connections) &&
          blockA.truePath === blockB.truePath &&
          blockA.falsePath === blockB.falsePath
        );
      });
    };

    const hasChanges = 
      name !== cadenceName ||
      description !== cadenceDescription ||
      !blocksEqual(normalizedCurrent, normalizedInitial);

    onChanges(hasChanges);
  }, [blocks, name, description, cadenceName, cadenceDescription, initialBlocks, onChanges]);

  // Show success message when saveSuccess prop changes
  useEffect(() => {
    if (saveSuccess) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }, [saveSuccess]);

  const handleSave = useCallback(async () => {
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
  }, [blocks, autoSave, cadenceId, name, description, onSave]);

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
        } else if (block.type === 'trigger') {
          // Trigger blocks can have multiple connections
          if (!newBlock.connections) {
            newBlock.connections = [];
          }
          if (!newBlock.connections.includes(toId)) {
            newBlock.connections = [...newBlock.connections, toId];
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
      case 'voicecall': return 'Make voice call';
      case 'calendar': return 'Send calendar invite';
      case 'conditional': return 'Check condition';
      case 'delay': return 'Wait';
      case 'end': return 'End cadence';
      default: return 'Start';
    }
  };

  const getDefaultConfig = (type: BlockType) => {
    switch (type) {
      case 'email':
        return { subject: '', body: '', threadSelection: 'new' as const };
      case 'voicecall':
        return { customPrompt: '', voicemailMessage: '', enableVoicemailFallback: true }; // Optional - uses defaults if empty
      case 'calendar':
        return { calendarTitle: '', calendarDescription: '', duration: 30 };
      case 'conditional':
        return { conditionType: undefined as any, conditionValue: '' };
      case 'delay':
        return { delayDays: 1, delayHours: 0 };
      default:
        return {};
    }
  };

  // Get all email blocks that come before the given block (for thread selection)
  const getPreviousEmailBlocks = (blockId: string): FlowBlock[] => {
    const visited = new Set<string>();
    const previousBlocks: FlowBlock[] = [];
    
    // Traverse forward from trigger to find all email blocks that come before target block
    const traverseForward = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      // If we've reached the target block, stop
      if (currentId === blockId) return;
      
      const currentBlock = blocks.find(b => b.id === currentId);
      if (!currentBlock) return;
      
      // If this is an email block and comes before our target block, add it
      if (currentBlock.type === 'email' && currentBlock.id !== blockId) {
        previousBlocks.push(currentBlock);
      }
      
      // Continue traversing forward through connections
      if (currentBlock.connections && currentBlock.connections.length > 0) {
        for (const nextId of currentBlock.connections) {
          traverseForward(nextId);
        }
      }
      
      // Also check true/false paths for conditional blocks
      if (currentBlock.type === 'conditional') {
        if (currentBlock.truePath) {
          traverseForward(currentBlock.truePath);
        }
        if (currentBlock.falsePath) {
          traverseForward(currentBlock.falsePath);
        }
      }
    };
    
    // Start from trigger and traverse forward
    const triggerBlock = blocks.find(b => b.type === 'trigger');
    if (triggerBlock) {
      traverseForward(triggerBlock.id);
    }
    
    return previousBlocks;
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
  }, [dragging, dragOffset, draggingConnection, connectingFrom, connectionPoint, connectionStartPos, autoSave, pan, zoom, handleSave]);

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

  const handlePanMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

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
  }, [isPanning, panStart, handlePanMove]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Reset scroll state when new messages arrive
    setTimeout(() => {
      setIsChatAtBottom(true);
      setIsChatScrolled(false);
      // Re-check scrollable content
      const container = chatMessagesRef.current;
      if (container) {
        setHasScrollableContent(container.scrollHeight > container.clientHeight);
      }
    }, 150);
  }, [chatMessages, isChatLoading]);

  // Track scroll position for gradient visibility
  useEffect(() => {
    if (!isRightSidebarOpen) return;
    
    const messagesContainer = chatMessagesRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      const container = messagesContainer;
      const hasScroll = container.scrollHeight > container.clientHeight;
      setHasScrollableContent(hasScroll);
      setIsChatScrolled(container.scrollTop > 5);
      // Check if near bottom (within 20px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 20;
      setIsChatAtBottom(isNearBottom);
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    // Use ResizeObserver to detect when content changes
    const resizeObserver = new ResizeObserver(() => {
      handleScroll();
    });
    resizeObserver.observe(messagesContainer);
    
    handleScroll(); // Check initial state

    return () => {
      messagesContainer.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [isRightSidebarOpen, chatMessages.length]);

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
    const config = blockTypeConfig[block.type] || {
      color: 'bg-gray-500',
      label: 'Unknown Block',
      icon: Square,
      canHaveMultipleOutputs: false,
    };
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
                  {block.type === 'delay' && (() => {
                    const parts: string[] = [];
                    const days = block.config.delayDays || 0;
                    const hours = block.config.delayHours || 0;
                    const minutes = block.config.delayMinutes || 0;
                    const seconds = block.config.delaySeconds || 0;
                    
                    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
                    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
                    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
                    if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
                    
                    return parts.length > 0 ? <div>{parts.join(', ')}</div> : null;
                  })()}
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
                    {(() => {
                      const threadSelection = block.config?.threadSelection || 
                                             (block.config?.replyToThread ? 'previous' : 'new');
                      const isReplying = threadSelection !== 'new';
                      
                      // If replying, find the original subject
                      let originalSubject = '';
                      if (isReplying) {
                        const selectedBlockId = threadSelection === 'previous' 
                          ? blocks.find(b => b.type === 'email' && b.id !== block.id && b.config?.subject)?.id
                          : threadSelection;
                        if (selectedBlockId) {
                          const prevBlock = blocks.find(b => b.id === selectedBlockId);
                          originalSubject = prevBlock?.config?.subject || '';
                        }
                      }
                      
                      return (
                        <>
                          <Input
                            value={isReplying ? originalSubject : (block.config?.subject || '')}
                            onChange={(e) => {
                              if (!isReplying) {
                                updateBlockConfig(block.id, { subject: e.target.value });
                              }
                            }}
                            placeholder="Email subject"
                            disabled={isReplying}
                            className={isReplying ? "bg-gray-100 cursor-not-allowed" : ""}
                          />
                          {isReplying && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ✓ Subject locked to match original thread for proper threading
                            </p>
                          )}
                          {!isReplying && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Subject for new email thread
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Body</label>
                    <textarea
                      value={block.config?.body || ''}
                      onChange={(e) => updateBlockConfig(block.id, { body: e.target.value })}
                      placeholder="Email body"
                      className="w-full min-h-[100px] p-2 border rounded bg-white text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Thread</label>
                    <select
                      value={block.config?.threadSelection || (block.config?.replyToThread ? 'previous' : 'new')}
                      onChange={(e) => {
                        const value = e.target.value;
                        const updates: any = { 
                          threadSelection: value,
                          replyToThread: value !== 'new' // Legacy support
                        };
                        
                        // If replying to a specific thread, auto-copy the subject and lock it
                        if (value !== 'new') {
                          const prevBlock = blocks.find(b => b.id === value);
                          if (prevBlock?.config?.subject) {
                            // Ensure subject matches exactly for threading
                            updates.subject = prevBlock.config.subject;
                          }
                        }
                        
                        updateBlockConfig(block.id, updates);
                      }}
                      className="w-full p-2 border rounded bg-white text-gray-900"
                    >
                      <option value="new">New thread</option>
                      {getPreviousEmailBlocks(block.id).map((prevBlock) => (
                        <option key={prevBlock.id} value={prevBlock.id}>
                          Reply to: {prevBlock.config?.subject || prevBlock.title || `Email ${prevBlock.id}`}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select which thread to reply to. Subject will be automatically locked to match the original for proper threading.
                    </p>
                  </div>
                </>
              )}

              {block.type === 'voicecall' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Custom System Prompt (Optional)</label>
                    <textarea
                      value={block.config?.customPrompt || ''}
                      onChange={(e) => updateBlockConfig(block.id, { customPrompt: e.target.value })}
                      placeholder="Leave empty to use default prompt. Override to customize AI agent behavior."
                      className="w-full min-h-[120px] p-2 border rounded bg-white text-gray-900 placeholder:text-gray-400"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The AI agent will call to schedule a meeting. Default prompt includes your company name and meeting scheduling instructions.
                    </p>
                  </div>
                  <div className="mt-4">
                    <label className="text-sm font-medium mb-1 block">Voicemail Fallback</label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={block.config?.enableVoicemailFallback !== false}
                        onChange={(e) => updateBlockConfig(block.id, { enableVoicemailFallback: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Leave voicemail if call isn&apos;t answered</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      If enabled, will automatically leave a voicemail with contact information if the call goes to voicemail.
                    </p>
                  </div>
                  {block.config?.enableVoicemailFallback !== false && (
                    <div className="mt-4">
                      <label className="text-sm font-medium mb-1 block">Custom Voicemail Message (Optional)</label>
                      <textarea
                        value={block.config?.voicemailMessage || ''}
                        onChange={(e) => updateBlockConfig(block.id, { voicemailMessage: e.target.value })}
                        placeholder="Leave empty to use default voicemail message with contact information."
                        className="w-full min-h-[100px] p-2 border rounded bg-white text-gray-900 placeholder:text-gray-400"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Custom message to leave if call goes to voicemail. Default includes your contact information.
                      </p>
                    </div>
                  )}
                </>
              )}

              {block.type === 'calendar' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Event Title *</label>
                    <Input
                      value={block.config?.calendarTitle || ''}
                      onChange={(e) => updateBlockConfig(block.id, { calendarTitle: e.target.value })}
                      placeholder="Meeting title"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Description</label>
                    <textarea
                      value={block.config?.calendarDescription || ''}
                      onChange={(e) => updateBlockConfig(block.id, { calendarDescription: e.target.value })}
                      placeholder="Event description"
                      className="w-full min-h-[80px] p-2 border rounded bg-white text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Duration (minutes)</label>
                    <Input
                      type="number"
                      min="15"
                      step="15"
                      value={block.config?.duration ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateBlockConfig(block.id, { duration: val === '' ? 30 : parseInt(val) || 30 });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Time Constraints</label>
                    <select
                      value={block.config?.timeConstraint || 'business_hours'}
                      onChange={(e) => updateBlockConfig(block.id, { timeConstraint: e.target.value as any })}
                      className="w-full p-2 border rounded bg-white text-gray-900"
                    >
                      <option value="none">No constraints (any time)</option>
                      <option value="business_hours">Business Hours (9am - 5pm)</option>
                    </select>
                    {block.config?.timeConstraint === 'business_hours' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Meeting will be scheduled between 9:00 AM and 5:00 PM on weekdays
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={block.config?.checkAvailability !== false}
                        onChange={(e) => updateBlockConfig(block.id, { checkAvailability: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Check availability before scheduling</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      If checked, will find the next available slot within your constraints
                    </p>
                  </div>
                </>
              )}

              {block.type === 'conditional' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Condition Type</label>
                    <select
                      value={block.config?.conditionType || ''}
                      onChange={(e) => updateBlockConfig(block.id, { conditionType: e.target.value as any })}
                      className="w-full p-2 border rounded bg-white text-gray-900"
                    >
                      <option value="">Select condition...</option>
                      <option value="email_opened">Email opened</option>
                      <option value="email_not_opened">Email not opened</option>
                      <option value="email_replied">Email replied</option>
                      <option value="email_not_replied">Email not replied</option>
                      <option value="email_opened_within_days">Email opened within days</option>
                      <option value="email_replied_within_days">Email replied within days</option>
                    </select>
                  </div>
                  {(block.config?.conditionType === 'email_opened_within_days' || 
                    block.config?.conditionType === 'email_replied_within_days') && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Days</label>
                      <Input
                        type="number"
                        value={block.config?.conditionValue || ''}
                        onChange={(e) => updateBlockConfig(block.id, { conditionValue: e.target.value })}
                        placeholder="e.g., 3"
                      />
                    </div>
                  )}
                </>
              )}

              {block.type === 'delay' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Seconds</label>
                    <Input
                      type="number"
                      min="0"
                      value={delayInputs[block.id]?.seconds !== undefined ? delayInputs[block.id].seconds : (block.config?.delaySeconds ?? 0)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDelayInputs(prev => ({
                          ...prev,
                          [block.id]: { ...prev[block.id], seconds: val }
                        }));
                        const numVal = val === '' ? 0 : (parseInt(val) || 0);
                        updateBlockConfig(block.id, { delaySeconds: numVal });
                      }}
                      onBlur={() => {
                        // Clear local state on blur so it syncs with config
                        setDelayInputs(prev => {
                          const next = { ...prev };
                          delete next[block.id]?.seconds;
                          if (Object.keys(next[block.id] || {}).length === 0) {
                            delete next[block.id];
                          }
                          return next;
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Minutes</label>
                    <Input
                      type="number"
                      min="0"
                      value={delayInputs[block.id]?.minutes !== undefined ? delayInputs[block.id].minutes : (block.config?.delayMinutes ?? 0)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDelayInputs(prev => ({
                          ...prev,
                          [block.id]: { ...prev[block.id], minutes: val }
                        }));
                        const numVal = val === '' ? 0 : (parseInt(val) || 0);
                        updateBlockConfig(block.id, { delayMinutes: numVal });
                      }}
                      onBlur={() => {
                        setDelayInputs(prev => {
                          const next = { ...prev };
                          delete next[block.id]?.minutes;
                          if (Object.keys(next[block.id] || {}).length === 0) {
                            delete next[block.id];
                          }
                          return next;
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Hours</label>
                    <Input
                      type="number"
                      min="0"
                      value={delayInputs[block.id]?.hours !== undefined ? delayInputs[block.id].hours : (block.config?.delayHours ?? 0)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDelayInputs(prev => ({
                          ...prev,
                          [block.id]: { ...prev[block.id], hours: val }
                        }));
                        const numVal = val === '' ? 0 : (parseInt(val) || 0);
                        updateBlockConfig(block.id, { delayHours: numVal });
                      }}
                      onBlur={() => {
                        setDelayInputs(prev => {
                          const next = { ...prev };
                          delete next[block.id]?.hours;
                          if (Object.keys(next[block.id] || {}).length === 0) {
                            delete next[block.id];
                          }
                          return next;
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Days</label>
                    <Input
                      type="number"
                      min="0"
                      value={delayInputs[block.id]?.days !== undefined ? delayInputs[block.id].days : (block.config?.delayDays ?? 0)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDelayInputs(prev => ({
                          ...prev,
                          [block.id]: { ...prev[block.id], days: val }
                        }));
                        const numVal = val === '' ? 0 : (parseInt(val) || 0);
                        updateBlockConfig(block.id, { delayDays: numVal });
                      }}
                      onBlur={() => {
                        setDelayInputs(prev => {
                          const next = { ...prev };
                          delete next[block.id]?.days;
                          if (Object.keys(next[block.id] || {}).length === 0) {
                            delete next[block.id];
                          }
                          return next;
                        });
                      }}
                      placeholder="0"
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
              <Button variant="outline" size="sm" onClick={() => onClose(false)}>
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
              <div className="flex items-end gap-2">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!name.trim()) {
                      alert('Please enter a cadence name');
                      return;
                    }
                    handleSave();
                  }}
                  disabled={!name.trim()}
                  type="button"
                >
                  Save Cadence
                </Button>
              </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar Toggle Button */}
        <button
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 z-50 bg-background border border-border rounded-r-md p-1.5 hover:bg-accent transition-colors"
          style={{ display: isLeftSidebarOpen ? 'none' : 'block' }}
        >
          {isLeftSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Block palette - Left Sidebar */}
        <AnimatePresence>
          {isLeftSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-64 border-r bg-background overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
                <h3 className="text-sm font-semibold text-foreground">Add Block</h3>
                <button
                  onClick={() => setIsLeftSidebarOpen(false)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
            </motion.div>
          )}
        </AnimatePresence>

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
          }}
          onMouseDown={(e) => {
            e.stopPropagation(); // Prevent modal from closing when clicking canvas
            handlePanStart(e);
          }}
        >

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

        {/* Right Sidebar Toggle Button */}
        <button
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 z-50 bg-background border border-border rounded-l-md p-1.5 hover:bg-accent transition-colors"
          style={{ display: isRightSidebarOpen ? 'none' : 'block' }}
        >
          {isRightSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* Chat Sidebar - Right Panel */}
        <AnimatePresence>
          {isRightSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              data-chat-container
              className="w-64 border-l bg-background overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
                <h3 className="text-sm font-semibold text-foreground">Agentic Builder</h3>
                <button
                  onClick={() => setIsRightSidebarOpen(false)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Chat Messages */}
              <div
                ref={chatMessagesRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 relative scroll-smooth"
              >
                {/* Fade gradient at top */}
                {hasScrollableContent && (
                  <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background via-background/80 to-transparent pointer-events-none z-10" />
                )}

                {chatMessages.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    Ask me anything about your workflow
                  </div>
                )}

                {chatMessages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02, duration: 0.2, ease: "easeOut" }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-white text-foreground border border-border/20'
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
                    className="flex justify-start"
                  >
                    <div className="bg-white rounded-lg px-2.5 py-1.5 shadow-sm border border-border/20">
                      <motion.div
                        className="flex gap-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-primary"
                            animate={{
                              scale: [1, 1.5, 1],
                              opacity: [0.5, 1, 0.5],
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: i * 0.2,
                            }}
                          />
                        ))}
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Fade gradient at bottom */}
                {!isChatAtBottom && (
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-10" />
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Execution Log */}
              {executionLog.length > 0 && (
                <div className="border-t border-border p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-foreground">Execution Log</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExecutionLog([])}
                      className="h-6 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto text-xs font-mono space-y-1 bg-background p-2 rounded border border-border">
                    {executionLog.map((log, idx) => (
                      <div key={idx} className="text-muted-foreground">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Input */}
              <div className="p-4 border-t">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!chatInput.trim() || isChatLoading) return;

                    const userMessage = chatInput.trim();
                    setChatInput('');
                    setIsChatOpen(true);
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
                  className="relative flex items-center bg-background border border-border rounded-full px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all"
                >
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value);
                      setIsChatOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!chatInput.trim() || isChatLoading) return;

                        const userMessage = chatInput.trim();
                        setChatInput('');
                        setIsChatOpen(true);
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
                    placeholder="Ask about your workflow..."
                    className="flex-1 bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground pr-2 min-w-0"
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="ml-1.5 flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
