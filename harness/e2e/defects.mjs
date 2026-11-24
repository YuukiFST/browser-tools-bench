// One defect per build. `fails` is declared by reading the scenarios: every scenario the defect must
// break, and no other. oracle.mjs checks it. `probe` is the scenario every tool runs on the build.
export const defects = [
  {
    id: 'counter-ignores-completed',
    before: 'return todo.completed ? accum : accum + 1;',
    after: 'return accum + 1;',
    fails: [
      'completing-todos/should-complete-multiple-todos', 'completing-todos/should-complete-single-todo',
      'completing-todos/should-toggle-all-todos-complete', 'completing-todos/should-toggle-all-todos-incomplete',
      'deleting-todos/should-clear-all-completed-todos', 'filtering-todos/should-filter-active-todos',
    ],
    probe: 'completing-todos/should-complete-single-todo',
  },
  {
    id: 'escape-saves-edit',
    before: 'this.setState({ editText: this.props.todo.title });\n            this.props.onCancel(event);',
    after: 'this.handleSubmit(event);',
    fails: ['editing-todos/should-cancel-edit-on-escape'],
    probe: 'editing-todos/should-cancel-edit-on-escape',
  },
  {
    id: 'active-filter-shows-all',
    before: 'return !todo.completed;\n                case',
    after: 'return true;\n                case',
    fails: ['filtering-todos/should-filter-active-todos'],
    probe: 'filtering-todos/should-filter-active-todos',
  },
  {
    id: 'accepts-empty-todo',
    before: "if (val) {\n            this.props.model.addTodo(val);",
    after: "if (true) {\n            this.props.model.addTodo(val);",
    fails: ['adding-todos/should-not-add-empty-todo', 'todo-creation/prevent-empty-todo', 'todo-creation/prevent-whitespace-todo'],
    probe: 'todo-creation/prevent-empty-todo',
  },
  {
    id: 'delete-removes-first',
    before: 'return candidate !== todo;',
    after: 'return candidate !== arguments[2][0];',
    fails: ['deleting-todos/should-delete-specific-todo-from-multiple'],
    probe: 'deleting-todos/should-delete-specific-todo-from-multiple',
  },
];
