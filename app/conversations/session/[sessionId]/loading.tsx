import { QuestionCardSkeleton, PageSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <PageSkeleton>
      <QuestionCardSkeleton />
    </PageSkeleton>
  );
}
