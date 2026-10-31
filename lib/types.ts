export type Profile = { id:string; username:string; full_name:string; role:'admin'|'juri'; title:string|null; created_at:string };
export type Finalist = { id:string; name:string; study_program:string; gender:'putra'|'putri'; created_at:string };
export type Score = { id:string; judge_id:string; finalist_id:string; score:number; updated_at:string };
export const STUDY_PROGRAMS = ['S1 Informatika','S1 Sistem Informasi','S1 Teknologi Informasi','S1 Manajemen','S1 Akuntansi','S1 Sastra Inggris','S1 Pendidikan Bahasa Inggris','S1 Pendidikan Olahraga'];
export const JUDGE_ROLES = ['Ketua Juri','Juri 2','Juri 3','Juri 4','Juri 5'];
export const WINNER_TITLES = ['Winner','1st Runner Up','2nd Runner Up','3rd Runner Up','4th Runner Up','5th Runner Up'];
