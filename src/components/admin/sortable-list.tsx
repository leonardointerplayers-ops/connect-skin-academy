"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderAction } from "@/actions/content";
import { cn } from "@/lib/utils";

type Kind = Parameters<typeof reorderAction>[0];

function Row({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-lg border bg-card", isDragging && "relative z-10 shadow-lg ring-2 ring-primary/30")}
    >
      {!disabled && (
        <button
          type="button"
          className="flex h-full cursor-grab touch-none items-center self-stretch px-2 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className={cn("min-w-0 flex-1", disabled && "pl-3")}>{children}</div>
    </li>
  );
}

export function SortableList<T extends { id: string }>({
  items,
  kind,
  parentId,
  render,
  disabled,
}: {
  items: T[];
  kind: Kind;
  parentId: string | null;
  render: (item: T, index: number) => React.ReactNode;
  disabled?: boolean;
}) {
  const [order, setOrder] = useState(items);
  const [prevItems, setPrevItems] = useState(items);
  const [, startTransition] = useTransition();
  if (items !== prevItems) {
    setPrevItems(items);
    setOrder(items);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.findIndex((i) => i.id === e.active.id);
    const to = order.findIndex((i) => i.id === e.over!.id);
    const next = arrayMove(order, from, to);
    const previous = order;
    setOrder(next);
    startTransition(async () => {
      const res = await reorderAction(kind, parentId, next.map((i) => i.id));
      if (!res.ok) {
        setOrder(previous);
        toast.error(res.error);
      }
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {order.map((item, index) => (
            <Row key={item.id} id={item.id} disabled={disabled}>
              {render(item, index)}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
