export type RoleId = "admin" | "manager" | "collaborator";
export type ProfileStatus = "invited" | "active" | "inactive";
export type ContentStatus = "draft" | "published" | "archived";
export type ProgressStatus = "not_started" | "in_progress" | "completed";
export type ReleaseType = "immediate" | "date" | "days_after_join";
export type ModuleState = "unlocked" | "locked_date" | "locked_sequence" | "unavailable";
export type QuestionType = "single_choice" | "true_false" | "multiple_choice" | "essay";
export type Difficulty = "easy" | "medium" | "hard";
export type ShowAnswers = "never" | "after_submit" | "after_pass" | "after_last_attempt";
export type VideoProviderId = "supabase" | "external" | "youtube" | "vimeo" | "cloudflare" | "mux";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  area: string | null;
  company: string | null;
  avatar_path: string | null;
  role_id: RoleId;
  status: ProfileStatus;
  manager_id: string | null;
  joined_at: string;
  invited_at: string | null;
  activated_at: string | null;
  last_seen_at: string | null;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AppSettings {
  platform_name: string;
  company_name: string;
  ranking_enabled: boolean;
  ranking_criteria: "points" | "completions" | "scores" | "streak";
  inactivity_alert_days: number;
  default_video_completion_percent: number;
  reminder_emails_enabled: boolean;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  cover_path: string | null;
  thumbnail_path: string | null;
  status: ContentStatus;
  position: number;
  require_sequential: boolean;
  certificate_enabled: boolean;
  workload_hours: number | null;
  due_days: number | null;
  audience: "all" | "groups";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_path: string | null;
  thumbnail_path: string | null;
  featured_image_path: string | null;
  position: number;
  status: ContentStatus;
  release_type: ReleaseType;
  release_at: string | null;
  release_days: number | null;
  due_date: string | null;
  points: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  title: string | null;
  provider: VideoProviderId;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  provider_asset_id: string | null;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  status: "uploading" | "processing" | "ready" | "error";
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_html: string | null;
  content_json: unknown;
  video_id: string | null;
  position: number;
  status: ContentStatus;
  is_required: boolean;
  video_required: boolean;
  min_video_percent: number;
  activity_enabled: boolean;
  activity_title: string | null;
  activity_instructions: string | null;
  activity_requires_response: boolean;
  estimated_minutes: number | null;
  points: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  bucket: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  external_url: string | null;
  status: "active" | "archived";
  tags: string[];
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  module_id: string;
  course_id: string;
  status: "in_progress" | "completed";
  view_count: number;
  first_viewed_at: string;
  last_viewed_at: string;
  time_spent_seconds: number;
  video_position_seconds: number;
  video_max_position_seconds: number;
  video_duration_seconds: number | null;
  video_percent: number;
  video_completed_at: string | null;
  activity_response: string | null;
  activity_completed_at: string | null;
  completed_at: string | null;
}

export interface ModuleProgress {
  user_id: string;
  module_id: string;
  course_id: string;
  lessons_completed: number;
  lessons_total: number;
  percent: number;
  exam_required: boolean;
  exam_passed: boolean | null;
  best_score: number | null;
  status: ProgressStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface CourseProgress {
  user_id: string;
  course_id: string;
  modules_completed: number;
  modules_total: number;
  percent: number;
  status: ProgressStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface Exam {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  passing_score: number;
  question_count: number | null;
  max_attempts: number | null;
  time_limit_minutes: number | null;
  selection_mode: "fixed" | "random";
  random_categories: string[];
  random_difficulties: Difficulty[];
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_result: boolean;
  show_answers: ShowAnswers;
  show_explanations: boolean;
  is_required: boolean;
  points: number;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number;
}

export interface Question {
  id: string;
  number: number;
  statement: string;
  type: QuestionType;
  category: string | null;
  difficulty: Difficulty;
  explanation: string | null;
  points: number;
  module_id: string | null;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
  question_options?: QuestionOption[];
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  user_id: string;
  attempt_number: number;
  status: "in_progress" | "submitted" | "expired";
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  time_spent_seconds: number | null;
  score_percent: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  passed: boolean | null;
}

/** Retorno de fn_course_outline */
export interface OutlineModule {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_path: string | null;
  thumbnail_path: string | null;
  position: number;
  due_date: string | null;
  state: ModuleState;
  release_at: string | null;
  lessons_total: number;
  lessons_completed: number;
  percent: number;
  status: ProgressStatus;
  completed_at: string | null;
  exam: {
    id: string;
    title: string;
    is_required: boolean;
    passing_score: number;
    max_attempts: number | null;
    attempts_used: number;
    passed: boolean;
    best_score: number | null;
  } | null;
  competencies: string[];
}

/** Retorno de fn_get_attempt */
export interface AttemptPayload {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  module_id: string;
  status: ExamAttempt["status"];
  attempt_number: number;
  max_attempts: number | null;
  started_at: string;
  expires_at: string | null;
  server_now: string;
  questions: { id: string; statement: string; type: QuestionType; options: { id: string; text: string }[] }[];
  answers: Record<string, string[]>;
}

/** Retorno de fn_get_attempt_result */
export interface AttemptResult {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  module_id: string;
  status: ExamAttempt["status"];
  attempt_number: number;
  attempts_used: number;
  max_attempts: number | null;
  passing_score: number;
  show_result: boolean;
  review_allowed: boolean;
  score_percent: number | null;
  passed: boolean | null;
  correct_count: number | null;
  wrong_count: number | null;
  time_spent_seconds: number | null;
  started_at: string;
  submitted_at: string | null;
  questions: {
    id: string;
    number: number;
    statement: string;
    type: QuestionType;
    is_correct: boolean | null;
    selected_option_ids: string[];
    explanation: string | null;
    options: { id: string; text: string; is_correct: boolean }[] | null;
  }[];
  history: {
    id: string;
    attempt_number: number;
    status: ExamAttempt["status"];
    score_percent: number | null;
    passed: boolean | null;
    submitted_at: string | null;
  }[];
}

/** Linha de v_user_learning_summary */
export interface UserLearningSummary {
  user_id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  area: string | null;
  company: string | null;
  avatar_path: string | null;
  role_id: RoleId;
  status: ProfileStatus;
  joined_at: string;
  activated_at: string | null;
  last_seen_at: string | null;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  overall_percent: number;
  courses_completed: number;
  courses_enrolled: number;
  modules_completed: number;
  lessons_completed: number;
  lessons_started: number;
  exam_attempts: number;
  exams_taken: number;
  exams_passed: number;
  failed_attempts: number;
  avg_best_score: number | null;
  avg_attempts_per_exam: number | null;
  time_studied_seconds: number;
  active_days_30: number;
  last_activity_at: string | null;
  days_since_activity: number | null;
  overdue_items: number;
  next_due_date: string | null;
  manager_id: string | null;
}

export interface ModuleStats {
  module_id: string;
  course_id: string;
  title: string;
  position: number;
  status: ContentStatus;
  enrolled: number;
  completed: number;
  in_progress: number;
  avg_percent: number | null;
  exam_id: string | null;
  users_attempted: number | null;
  users_passed: number | null;
  total_attempts: number | null;
  avg_best_score: number | null;
  avg_score: number | null;
  approval_rate: number | null;
  avg_attempts: number | null;
  users_failed_twice: number | null;
}

export interface LessonStats {
  lesson_id: string;
  module_id: string;
  course_id: string;
  title: string;
  position: number;
  status: ContentStatus;
  is_required: boolean;
  total_views: number;
  unique_viewers: number;
  completions: number;
  abandoned: number;
  avg_time_seconds: number | null;
  avg_video_percent: number | null;
}

export interface QuestionStats {
  question_id: string;
  number: number;
  statement: string;
  type: QuestionType;
  category: string | null;
  difficulty: Difficulty;
  module_id: string | null;
  exam_id: string;
  total_answers: number;
  correct: number;
  wrong: number;
  pct_correct: number | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  image_path: string | null;
  link_url: string | null;
  link_label: string | null;
  priority: "low" | "normal" | "high";
  status: ContentStatus;
  show_banner: boolean;
  publish_at: string;
  expires_at: string | null;
  created_at: string;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  rule_type: string;
  rule_value: number;
  points: number;
  active: boolean;
}
