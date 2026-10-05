/** @jsxImportSource test */
import { memo, StrictMode, useEffect } from "react";
import { View, ViewProps } from "react-native";

import {
  act,
  colorScheme,
  cssInterop,
  registerCSS,
  render,
  screen,
  setupAllComponents,
  useUnstableNativeVariable,
} from "test";

const testID = "react-native-css-interop";
setupAllComponents();

test("inline variable", () => {
  registerCSS(`.my-class { width: var(--my-var); --my-var: 10px; }`);

  render(<View testID={testID} className="my-class" />);
  const component = screen.getByTestId(testID);

  expect(component).toHaveStyle({
    width: 10,
  });
});

test("combined inline variable", () => {
  registerCSS(`
    .my-class-1 { width: var(--my-var); }
    .my-class-2 { --my-var: 10px; }
    .my-class-3 { --my-var: 20px; }
  `);

  render(<View testID={testID} className="my-class-1 my-class-2" />);
  const component = screen.getByTestId(testID);

  expect(component).toHaveStyle({
    width: 10,
  });

  // Prove that the order doesn't matter
  screen.rerender(<View testID={testID} className="my-class-1 my-class-3" />);

  expect(component).toHaveStyle({
    width: 20,
  });
});

test("inherit variables", () => {
  registerCSS(`
    .my-class-1 { width: var(--my-var); }
    .my-class-2 { --my-var: 10px; }
    .my-class-3 { --my-var: 20px; }
  `);

  const effect = jest.fn();
  const Child = (props: ViewProps) => {
    useEffect(effect);
    return <View {...props} />;
  };

  cssInterop(Child, {
    className: "style",
  });

  const { getByTestId } = render(
    <View testID="a" className="my-class-2">
      <Child testID="b" className="my-class-1" />
    </View>,
  );

  const a = getByTestId("a");
  let b = getByTestId("b");

  expect(a).toHaveStyle(undefined);
  expect(b).toHaveStyle({ width: 10 });
  expect(effect).toHaveBeenCalledTimes(1);

  screen.rerender(
    <View testID="a" className="my-class-3">
      <View testID="b" className="my-class-1" />
    </View>,
  );

  b = getByTestId("b");

  // expect(B.mock).toHaveBeenCalledTimes(2);
  expect(a).toHaveStyle(undefined);
  expect(b).toHaveStyle({ width: 20 });
});

test("inherit variables - memo", () => {
  const effect = jest.fn();
  const Child = memo((props: ViewProps) => {
    useEffect(effect);
    return <View {...props} />;
  });

  cssInterop(Child, {
    className: "style",
  });

  registerCSS(`
    .my-class-1 { width: var(--my-var); }
    .my-class-2 { --my-var: 10px; }
    .my-class-3 { --my-var: 20px; }
  `);

  const { getByTestId } = render(
    <View testID="a" className="my-class-2">
      <Child testID="b" className="my-class-1" />
    </View>,
  );

  const a = getByTestId("a");
  let b = getByTestId("b");

  expect(a).toHaveStyle(undefined);
  expect(b).toHaveStyle({ width: 10 });

  screen.rerender(
    <View testID="a" className="my-class-3">
      <Child testID="b" className="my-class-1" />
    </View>,
  );

  b = getByTestId("b");

  expect(a).toHaveStyle(undefined);
  expect(b).toHaveStyle({ width: 20 });
});

test(":root variables", () => {
  registerCSS(`
    :root { --my-var: red; }
    .my-class { color: var(--my-var); }
  `);

  const component = render(
    <View testID={testID} className="my-class" />,
  ).getByTestId(testID);

  expect(component).toHaveStyle({ color: "red" });
});

test("can apply and set new variables", () => {
  registerCSS(`
    :root { --my-var: red; }
    .my-class { color: var(--my-var); --another-var: green; }
    .another-class { color: var(--another-var); }
  `);

  const testIDs = {
    one: "one",
    two: "two",
    three: "three",
  };

  render(
    <View testID={testIDs.one} className="my-class">
      <View testID={testIDs.two} className="my-class" />
      <View testID={testIDs.three} className="another-class" />
    </View>,
  );

  expect(screen.getByTestId(testIDs.one)).toHaveStyle({ color: "red" });
  expect(screen.getByTestId(testIDs.two)).toHaveStyle({ color: "red" });
  expect(screen.getByTestId(testIDs.three)).toHaveStyle({ color: "green" });
});

test("variables will be collected", () => {
  registerCSS(`
    :root { --my-var: red; }
    .green { --var-2: green; }
    .blue { --var-3: blue; }
    .color { color: var(--var-2); }
    .background { background-color: var(--var-3); }
  `);

  const testIDs = {
    one: "one",
    two: "two",
    three: "three",
  };

  render(
    <View testID={testIDs.one} className="green">
      <View testID={testIDs.two} className="blue">
        <View testID={testIDs.three} className="color background" />
      </View>
    </View>,
  );

  expect(screen.getByTestId(testIDs.three)).toHaveStyle({
    color: "green",
    backgroundColor: "blue",
  });
});

test("useUnsafeVariable", () => {
  registerCSS(`
    :root { --my-var: red; }
    .test { color: var(--my-var); }
  `);

  let myVar;

  const Component = () => {
    myVar = useUnstableNativeVariable("--my-var");
    return null;
  };

  render(<Component />);

  expect(myVar).toEqual("red");
});

test("useUnstableNativeVariable follows the color scheme and releases its subscriptions", () => {
  registerCSS(`
    :root { --my-var: white; }
    @media (prefers-color-scheme: dark) {
      :root { --my-var: black; }
    }
    .test { color: var(--my-var); }
  `);

  const getColorScheme = jest.spyOn(colorScheme, "get");
  let myVar;

  const Component = () => {
    myVar = useUnstableNativeVariable("--my-var");
    return null;
  };

  render(<Component />);

  const { dependencies } = getColorScheme.mock.calls.find(
    ([effect]) => effect,
  )![0]!;

  for (const [scheme, expected] of [
    ["dark", "black"],
    ["light", "white"],
    ["dark", "black"],
    ["light", "white"],
  ] as const) {
    act(() => colorScheme.set(scheme));
    expect(myVar).toEqual(expected);
    const subscriptions = dependencies.size;

    screen.rerender(<Component />);
    expect(myVar).toEqual(expected);
    expect(dependencies.size).toEqual(subscriptions);
  }

  screen.unmount();

  expect(dependencies.size).toEqual(0);
});

test("useUnstableNativeVariable follows the color scheme in StrictMode", () => {
  registerCSS(`
    :root { --my-var: white; }
    @media (prefers-color-scheme: dark) {
      :root { --my-var: black; }
    }
    .test { color: var(--my-var); }
  `);

  let myVar;

  const Component = () => {
    myVar = useUnstableNativeVariable("--my-var");
    return null;
  };

  render(
    <StrictMode>
      <Component />
    </StrictMode>,
  );

  act(() => colorScheme.set("dark"));
  expect(myVar).toEqual("black");

  act(() => colorScheme.set("light"));
  expect(myVar).toEqual("white");
});
