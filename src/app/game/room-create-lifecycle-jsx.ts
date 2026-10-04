import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from "react/jsx-runtime";

export { Fragment };
function withoutStyledJsx(type: unknown, props: unknown) {
  if (type !== "style" || !props || typeof props !== "object" || !("jsx" in props)) return props;
  const { jsx: _jsx, ...rest } = props;
  return rest;
}
export const jsx: typeof reactJsx = (type, props, key) => reactJsx(type, withoutStyledJsx(type, props), key);
export const jsxs: typeof reactJsxs = (type, props, key) => reactJsxs(type, withoutStyledJsx(type, props), key);
