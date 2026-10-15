import { bindProfileControls } from './modules/profile.js';
import { bindAppControls } from './app.js';
import { bindSettingsControls } from './modules/settings.js';
import { bindResumeControls } from './modules/resume.js';
import { bindExportControls } from './modules/export.js';
import { bindBackupControls } from './backup.js';
import { bindRecordsControls } from './modules/records.js';
import { bindImagesControls } from './modules/images.js';
import { bindOrganizationControls } from './modules/organization.js';
import { bindUniversitiesControls } from './modules/universities.js';
import { bindMaterialsControls } from './modules/materials.js';
import { bindDashboardControls } from './modules/dashboard.js';
import { bindMarkdownControls } from './modules/markdown.js';
import { bindHomeControls } from './modules/home.js';
import { bindQuizControls } from './modules/quiz.js';
import { bindExploreControls } from './modules/explore.js';
// Binding coordinator; each feature owns its controls.
function bind () {
  bindProfileControls ();
  bindAppControls ();
  bindSettingsControls ();
  bindResumeControls ();
  bindExportControls ();
  bindBackupControls ();
  bindRecordsControls ();
  bindImagesControls ();
  bindOrganizationControls ();
  bindUniversitiesControls ();
  bindMaterialsControls ();
  bindDashboardControls ();
  bindMarkdownControls ();
  bindHomeControls ();
  bindQuizControls ();
  bindExploreControls ();
}
export { bind };
