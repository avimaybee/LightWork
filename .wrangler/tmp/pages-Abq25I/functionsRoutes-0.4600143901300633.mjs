import { onRequestPost as __api_ai_generate_ts_onRequestPost } from "D:\\vs studio\\LightWork\\functions\\api\\ai\\generate.ts"
import { onRequestPost as __api_images_upload_ts_onRequestPost } from "D:\\vs studio\\LightWork\\functions\\api\\images\\upload.ts"
import { onRequestGet as __api_images__key__ts_onRequestGet } from "D:\\vs studio\\LightWork\\functions\\api\\images\\[key].ts"
import { onRequestDelete as __api_modules__id__ts_onRequestDelete } from "D:\\vs studio\\LightWork\\functions\\api\\modules\\[id].ts"
import { onRequestDelete as __api_projects__id__ts_onRequestDelete } from "D:\\vs studio\\LightWork\\functions\\api\\projects\\[id].ts"
import { onRequestPatch as __api_projects__id__ts_onRequestPatch } from "D:\\vs studio\\LightWork\\functions\\api\\projects\\[id].ts"
import { onRequestGet as __api_modules_ts_onRequestGet } from "D:\\vs studio\\LightWork\\functions\\api\\modules.ts"
import { onRequestPost as __api_modules_ts_onRequestPost } from "D:\\vs studio\\LightWork\\functions\\api\\modules.ts"
import { onRequestPost as __api_process_ts_onRequestPost } from "D:\\vs studio\\LightWork\\functions\\api\\process.ts"
import { onRequestGet as __api_projects_ts_onRequestGet } from "D:\\vs studio\\LightWork\\functions\\api\\projects.ts"
import { onRequestPost as __api_projects_ts_onRequestPost } from "D:\\vs studio\\LightWork\\functions\\api\\projects.ts"

export const routes = [
    {
      routePath: "/api/ai/generate",
      mountPath: "/api/ai",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_generate_ts_onRequestPost],
    },
  {
      routePath: "/api/images/upload",
      mountPath: "/api/images",
      method: "POST",
      middlewares: [],
      modules: [__api_images_upload_ts_onRequestPost],
    },
  {
      routePath: "/api/images/:key",
      mountPath: "/api/images",
      method: "GET",
      middlewares: [],
      modules: [__api_images__key__ts_onRequestGet],
    },
  {
      routePath: "/api/modules/:id",
      mountPath: "/api/modules",
      method: "DELETE",
      middlewares: [],
      modules: [__api_modules__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/projects/:id",
      mountPath: "/api/projects",
      method: "DELETE",
      middlewares: [],
      modules: [__api_projects__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/projects/:id",
      mountPath: "/api/projects",
      method: "PATCH",
      middlewares: [],
      modules: [__api_projects__id__ts_onRequestPatch],
    },
  {
      routePath: "/api/modules",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_modules_ts_onRequestGet],
    },
  {
      routePath: "/api/modules",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_modules_ts_onRequestPost],
    },
  {
      routePath: "/api/process",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_process_ts_onRequestPost],
    },
  {
      routePath: "/api/projects",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_projects_ts_onRequestGet],
    },
  {
      routePath: "/api/projects",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_projects_ts_onRequestPost],
    },
  ]