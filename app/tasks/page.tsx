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
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-2">
          <div className="mb-8 pt-0 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900 leading-6">Tasks</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "list" ? "kanban" : "list")} className="border-gray-200 hover:bg-gray-50">
                {viewMode === "list" ? "Kanban" : "List"}
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pb-6">

          {/* Filters */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Filter className="h-4 w-4 text-gray-600" />
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value as any })}
            >
              <SelectTrigger className="w-[150px] h-9 border-gray-200">
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
              <SelectTrigger className="w-[150px] h-9 border-gray-200">
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
            <div className="bg-white rounded-lg border border-gray-200">
              {tasks.length === 0 ? (
                <div className="p-12 text-center">
                  <EmptyState
                    icon={CheckSquare}
                    title="No tasks yet"
                    description="Create tasks to track your work."
                    actionLabel="New Task"
                    onAction={() => {
                      // TODO: Open new task modal
                    }}
                  />
                </div>
              ) : (
                <div>
                  <table className="w-full border-collapse">
                    <thead className="bg-background">
                      <tr>
                        <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                          Task
                        </th>
                        <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                          Priority
                        </th>
                        <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                          Status
                        </th>
                        <th className="px-7 py-4 text-left text-sm font-semibold text-gray-900 select-none">
                          Due Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task, index) => (
                        <motion.tr
                          key={task.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className="group hover:bg-indigo-50/50 transition-colors border-b border-gray-100"
                        >
                          <td className="px-7 py-5 text-sm">
                            <div className="text-base font-medium text-gray-900 mb-1">
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-sm text-gray-600">
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td className="px-7 py-5 text-sm">
                            <span className={`text-xs px-2 py-1 rounded ${
                              task.priority === "high" ? "bg-red-100 text-red-800" :
                              task.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-7 py-5 text-sm">
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                              {task.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-7 py-5 text-sm">
                            {task.dueDate ? (
                              <div className="text-sm text-gray-600">
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">—</div>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {["todo", "in_progress", "done", "blocked"].map((status) => {
                const statusTasks = tasks.filter((t) => t.status === status);
                return (
                  <div key={status} className="bg-white rounded-lg border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase">
                          {status.replace("_", " ")}
                        </h3>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {statusTasks.length}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      {statusTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {task.title}
                          </div>
                          {task.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


