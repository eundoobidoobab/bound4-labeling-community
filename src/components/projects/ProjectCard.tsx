import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Archive, RotateCcw, CalendarDays, Users } from 'lucide-react';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  index: number;
  isArchived?: boolean;
  isAdmin: boolean;
  isJoined: boolean;
  memberCount: number;
  onClick: (project: Project) => void;
  onEdit: (project: Project, e: React.MouseEvent) => void;
  onArchive: (project: Project) => void;
  onReactivate: (projectId: string, e: React.MouseEvent) => void;
}

export default function ProjectCard({
  project, index, isArchived = false, isAdmin, isJoined, memberCount,
  onClick, onEdit, onArchive, onReactivate,
}: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={`cursor-pointer transition-shadow hover:shadow-md ${isArchived ? 'opacity-70' : ''}`}
        onClick={() => onClick(project)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="text-base truncate">{project.name}</CardTitle>
              {isAdmin && !isJoined && (
                <Badge variant="outline" className="text-xs shrink-0">미참여</Badge>
              )}
              {isArchived && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">보관됨</span>
              )}
            </div>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => onEdit(project, e as any)}>
                    <Pencil className="mr-2 h-4 w-4" /> 수정
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isArchived ? (
                    <DropdownMenuItem onClick={(e) => onReactivate(project.id, e as any)}>
                      <RotateCcw className="mr-2 h-4 w-4" /> 활성화
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); onArchive(project); }}
                    >
                      <Archive className="mr-2 h-4 w-4" /> 보관
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(project.created_at).toLocaleDateString('ko-KR')}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {memberCount}명
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
