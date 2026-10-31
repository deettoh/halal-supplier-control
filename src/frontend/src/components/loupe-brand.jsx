import React, { useId } from "react";
import { loupeWordmark } from "./loupe-wordmark.js";

// One set of ribbon faces is shared by the static identity and the hinged intro.
const back = "M70 5Q70 0 65 3L12 32Q0 39 0 53V144L104 74Q104 66 98 63L70 49Z";
const crease = "M0 92L70 51L100 64Q104 66 104 73L29 111Q6 124 0 143Z";
const middle =
  "M0 125L99 68Q104 65 104 73V121L88 113Q73 103 54 108Q17 108 0 143Z";
const lowerCrease =
  "M54 108Q72 102 89 112L147 144Q162 152 162 167V178L91 139Q83 116 54 108Z";
const front =
  "M0 143Q0 121 22 113Q37 107 54 108Q73 108 88 123L148 156Q162 164 162 177Q162 192 146 192H49Q0 192 0 143Z";

function RibbonDrawing({ part }) {
  const id = useId();
  return (
    <>
      <defs>
        <mask
          id={id}
          maskUnits="userSpaceOnUse"
          x="-4"
          y="-4"
          width="172"
          height="204"
        >
          <rect x="-4" y="-4" width="172" height="204" fill="white" />
          <circle cx="54" cy="143" r="35" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${id})`} stroke="none">
        {(!part || part === "back") && (
          <g>
            <path d={back} fill="#f06423" />
            <path d={crease} fill="#b93c08" />
          </g>
        )}
        {(!part || part === "middle") && (
          <g>
            <path d={middle} fill="#f06423" />
            <path d={lowerCrease} fill="#b93c08" />
          </g>
        )}
        {(!part || part === "front") && <path d={front} fill="#f06423" />}
      </g>
    </>
  );
}
export function LoupeMark({ className = "", part }) {
  return (
    <svg
      className={`loupe-mark ${className}`}
      viewBox="-2 -2 168 198"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <RibbonDrawing part={part} />
    </svg>
  );
}
export function LoupeWordmark({ className = "" }) {
  return (
    <svg
      className={`loupe-wordmark ${className}`}
      viewBox={loupeWordmark.viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={loupeWordmark.path}
        transform={loupeWordmark.transform}
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
export function LoupeBrand() {
  return (
    <span className="loupe-brand" role="img" aria-label="Loupe">
      <LoupeMark />
      <LoupeWordmark />
    </span>
  );
}
export function UnfoldingRibbon() {
  return (
    <div className="ribbon-unfold" aria-hidden="true">
      {["back", "middle", "front"].map((part) => (
        <div key={part} className="ribbon-fold" data-ribbon-fold={part}>
          <LoupeMark part={part} />
        </div>
      ))}
    </div>
  );
}
