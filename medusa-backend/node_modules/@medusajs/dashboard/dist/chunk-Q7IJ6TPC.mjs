import {
  useFeatureFlag
} from "./chunk-PJU3RODH.mjs";

// src/hooks/use-require-rbac-feature.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
var useRequireRbacFeature = () => {
  const isRbacEnabled = useFeatureFlag("rbac");
  const navigate = useNavigate();
  useEffect(() => {
    if (!isRbacEnabled) {
      navigate(-1);
    }
  }, [isRbacEnabled, navigate]);
  return isRbacEnabled;
};

export {
  useRequireRbacFeature
};
