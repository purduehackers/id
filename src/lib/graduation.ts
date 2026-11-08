export const SEMESTERS = ['spring', 'fall'] as const;
export type Semester = (typeof SEMESTERS)[number];

export const SEMESTER_LABELS: Record<Semester, string> = { spring: 'Spring', fall: 'Fall' };

export function isSemester(value: unknown): value is Semester {
	return (SEMESTERS as readonly unknown[]).includes(value);
}

export const toTerm = (year: number, semester: Semester) =>
	year * 2 + (semester === 'fall' ? 1 : 0);

export const termYear = (term: number) => Math.floor(term / 2);

export const termSemester = (term: number): Semester => (term % 2 ? 'fall' : 'spring');

export function lastEndedTerm(now = new Date()) {
	const year = now.getUTCFullYear();
	return now.getUTCMonth() >= 5 ? toTerm(year, 'spring') : toTerm(year - 1, 'fall');
}

export function hasGraduated(term: unknown, now = new Date()) {
	return typeof term === 'number' && term <= lastEndedTerm(now);
}
