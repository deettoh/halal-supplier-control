import React from "react";
import { Check, X, Minus } from "lucide-react";
import { label } from "../lib/format.js";
export function Status({ value, children }) {
  const Icon = value === true ? Check : value === false ? X : null;
  return (
    <span className={"status status-" + String(value)}>
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children || label(value)}
    </span>
  );
}
export function RuleStatus({ passed }) {
  return (
    <span
      className={
        "rule-status " +
        (passed === true ? "pass" : passed === false ? "fail" : "unchecked")
      }
    >
      {passed === true ? (
        <Check size={13} aria-hidden="true" />
      ) : passed === false ? (
        <X size={13} aria-hidden="true" />
      ) : (
        <Minus size={13} aria-hidden="true" />
      )}
      {passed === true
        ? "Passed"
        : passed === false
          ? "Failed"
          : "Not evaluated"}
    </span>
  );
}
