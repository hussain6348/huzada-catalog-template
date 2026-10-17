import { onRequestDelete as __api_products__id__ts_onRequestDelete } from "C:\\Users\\ZASS\\huzada-catalog-template\\functions\\api\\products\\[id].ts"
import { onRequestPut as __api_products__id__ts_onRequestPut } from "C:\\Users\\ZASS\\huzada-catalog-template\\functions\\api\\products\\[id].ts"
import { onRequestPost as __api_order_ts_onRequestPost } from "C:\\Users\\ZASS\\huzada-catalog-template\\functions\\api\\order.ts"
import { onRequestGet as __api_products_ts_onRequestGet } from "C:\\Users\\ZASS\\huzada-catalog-template\\functions\\api\\products.ts"
import { onRequestPost as __api_products_ts_onRequestPost } from "C:\\Users\\ZASS\\huzada-catalog-template\\functions\\api\\products.ts"
import { onRequestPost as __api_upload_ts_onRequestPost } from "C:\\Users\\ZASS\\huzada-catalog-template\\functions\\api\\upload.ts"

export const routes = [
    {
      routePath: "/api/products/:id",
      mountPath: "/api/products",
      method: "DELETE",
      middlewares: [],
      modules: [__api_products__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/products/:id",
      mountPath: "/api/products",
      method: "PUT",
      middlewares: [],
      modules: [__api_products__id__ts_onRequestPut],
    },
  {
      routePath: "/api/order",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_order_ts_onRequestPost],
    },
  {
      routePath: "/api/products",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_products_ts_onRequestGet],
    },
  {
      routePath: "/api/products",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_products_ts_onRequestPost],
    },
  {
      routePath: "/api/upload",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_upload_ts_onRequestPost],
    },
  ]