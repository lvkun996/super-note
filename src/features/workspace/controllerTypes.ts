import type { Dispatch, SetStateAction } from "react";
import type { App as AntApp } from "antd";

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type AppFeedback = ReturnType<typeof AntApp.useApp>;
