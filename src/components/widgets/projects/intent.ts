// A one-shot hand-off from the widget's "+ Project" button to the expanded
// view it opens, so the view starts with the new-project form open.

let pending = false;

export function requestNewProject() {
  pending = true;
}

/** Read and clear the request. */
export function takeNewProjectRequest() {
  const was = pending;
  pending = false;
  return was;
}
