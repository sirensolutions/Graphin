import React from 'react';
import Graphin, { Utils } from '@antv/graphin';
import { UndoRedo } from '@antv/graphin-components';

// Do not forget to import CSS

const App = () => {
  const data = Utils.mock(5).circle().graphin();

  return (
    <div className="App">
      <Graphin data={data}>
        <UndoRedo />
      </Graphin>
    </div>
  );
};
export default App;
