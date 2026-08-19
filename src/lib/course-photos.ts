import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type CoursePhoto = {
  id: string;
  photo_url: string;
  caption: string;
  display_order: number;
};

export async function fetchCoursePhotos(): Promise<CoursePhoto[]> {
  const { data, error } = await supabase
    .from("course_photos")
    .select("id, photo_url, caption, display_order")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CoursePhoto[];
}

export function useCoursePhotos() {
  return useQuery({
    queryKey: ["course-photos"],
    queryFn: fetchCoursePhotos,
    staleTime: 1000 * 60 * 5,
  });
}
