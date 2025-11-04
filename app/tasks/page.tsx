"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Plus, Calendar, Clock, User, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/company/empty-state";

export const dynamic = 'force-dynamic';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignedTo?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [filters, setFilters] = useState({
    status: "all" as "all" | "todo" | "in_progress" | "done" | "blocked",
    priority: "all" as "all" | "low" | "medium" | "high",
    assignedTo: "all" as string | "all",
  });

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      // TODO: Fetch from tasks table when it exists
      // For now, use mock data
      const mockTasks: Task[] = [
        {
          id: "1",
          title: "Follow up with Company A",
          description: "Send pricing proposal",
          status: "todo",
          priority: "high",
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: "current-user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "2",
          title: "Schedule meeting with Company B",
          description: "Discuss partnership opportunity",
          status: "in_progress",
          priority: "medium",
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: "current-user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Filter tasks
      let filtered = mockTasks;
      if (filters.status !== "all") {
        filtered = filtered.filter((t) => t.status === filters.status);
      }
      if (filters.priority !== "all") {
        filtered = filtered.filter((t) => t.priority === filters.priority);
      }
      if (filters.assignedTo !== "all") {
        filtered = filtered.filter((t) => t.assignedTo === filters.assignedTo);
      }

      setTasks(filtered);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              List/Kanban toggle • Filters • Quick add • Task templates from AI suggestions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "list" ? "kanban" : "list")}>
              {viewMode === "list" ? "Kanban" : "List"}
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value as any })}
          >
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.priority}
            onValueChange={(value) => setFilters({ ...filters, priority: value as any })}
          >
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tasks List/Kanban */}
        {viewMode === "list" ? (
          <Card className="rounded-2xl shadow-sm border border-border p-5">
            <CardContent className="p-0">
              {tasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks yet"
                  description="Create tasks to track your work."
                  actionLabel="New Task"
                  onAction={() => {
                    // TODO: Open new task modal
                  }}
                />
              ) : (
                <div className="space-y-2">
                  {tasks.map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">
                              {task.title}
                            </span>
                            <Badge
                              variant={
                                task.priority === "high"
                                  ? "destructive"
                                  : task.priority === "medium"
                                  ? "default"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.status}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                              </div>
                            )}
                            {task.assignedTo && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>Assigned to: {task.assignedTo}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {["todo", "in_progress", "done", "blocked"].map((status) => {
              const statusTasks = tasks.filter((t) => t.status === status);
              return (
                <Card key={status} className="rounded-2xl shadow-sm border border-border p-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-foreground uppercase">
                      {status.replace("_", " ")}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs mt-1">
                      {statusTasks.length}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2 p-0">
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="text-sm font-medium text-foreground mb-1">
                          {task.title}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


