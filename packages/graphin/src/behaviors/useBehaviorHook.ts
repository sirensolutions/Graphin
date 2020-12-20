import React from 'react';
import GraphinContext from '../GraphinContext';

interface Props {
  type: string;
  defaultConfig: {};
  userProps: any;
  mode?: string;
}
const useBehaviorHook = (params: Props) => {
  const { type, defaultConfig, userProps, mode = 'default' } = params;
  const { graph } = React.useContext(GraphinContext) as any;
  const { disabled, ...otherConfig } = userProps;

  React.useEffect(() => {
    console.log('%c build-in behaviors:', 'color:lightblue', type);
    /** 保持单例 */
    graph.removeBehaviors(type, mode);

    if (disabled) {
      return;
    }
    graph.addBehaviors(
      {
        type,
        ...defaultConfig,
        ...otherConfig,
      },
      mode,
    );
    return () => {
      if (!graph.destroyed) {
        graph.removeBehaviors(type, mode);
      }
    };
  }, []);
};

export default useBehaviorHook;