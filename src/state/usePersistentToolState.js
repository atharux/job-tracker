import { useState, useEffect } from "react";

export function usePersistentToolState(toolId) {
  const storageKey = `tool_state_${toolId}`;

  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);

      return saved
        ? JSON.parse(saved)
        : {
            values: {},
            output: "",
          };
    } catch (err) {
      console.error("Failed to load tool state:", err);

      return {
        values: {},
        output: "",
      };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(state)
      );
    } catch (err) {
      console.error("Failed to save tool state:", err);
    }
  }, [storageKey, state]);

  const setValues = (updater) => {
    setState((prev) => ({
      ...prev,
      values:
        typeof updater === "function"
          ? updater(prev.values)
          : updater,
    }));
  };

  const setOutput = (output) => {
    setState((prev) => ({
      ...prev,
      output,
    }));
  };

  const clearState = () => {
    localStorage.removeItem(storageKey);

    setState({
      values: {},
      output: "",
    });
  };

  return {
    values: state.values,
    setValues,
    output: state.output,
    setOutput,
    clearState,
  };
}