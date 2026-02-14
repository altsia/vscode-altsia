
import { KatexOptions, renderToString } from "katex"
import splitAtDelimiters, { Delimiter } from "./delimiters";

const delimiters: Delimiter[] = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
]

export const renderKatexText = (text: string): string => {
  const options = {
    displayMode: false,
    throwOnError: true,
    trust: true,
    globalGroup: true,
    delimiters
  };

  const splitItems = splitAtDelimiters(text, delimiters)
  return splitItems.map((item) => {
    if (item.type === "math") {
      options.displayMode = item.display;
      return renderToString(item.data, options as KatexOptions)
    } else {
      return item.data
    }
  }).join("")
}
