import { CloseOutlined } from "@ant-design/icons";
import type { ModalFuncProps } from "antd";

export const neutralConfirmDialog: Pick<ModalFuncProps, "icon" | "closable" | "closeIcon" | "className" | "width"> = {
  icon: null,
  closable: true,
  closeIcon: <CloseOutlined />,
  className: "neutral-confirm-dialog",
  width: 430,
};

export const neutralInfoDialog: Pick<ModalFuncProps, "footer" | "closable" | "closeIcon" | "maskClosable" | "icon"> = {
  footer: null,
  closable: true,
  closeIcon: <CloseOutlined />,
  maskClosable: true,
  icon: null,
};
